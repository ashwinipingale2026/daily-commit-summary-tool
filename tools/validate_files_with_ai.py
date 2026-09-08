#!/usr/bin/env python3
"""Validate files in a folder against a markdown rules file using an AI provider."""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
import textwrap
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REQUIRED_SECTIONS = (
    "Attendees",
    "Risks",
    "Issues",
    "Dependencies",
    "Action Items",
)
SECTION_HEADING_PATTERN = re.compile(
    r"^\s*(?P<section>Attendees|Attendies|Risks|Issues|Dependencies|Action Items)\s*:?\s*$",
    re.IGNORECASE,
)
ACTION_ITEMS_TABLE_PATTERN = re.compile(
    r"^\s*\|\s*Action Item\s*\|\s*Owner\s*\|\s*Due Date\s*\|\s*$",
    re.IGNORECASE,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate files in a folder by sending the file contents and markdown rules to an AI model."
    )
    parser.add_argument("folder", help="Folder containing files to validate")
    parser.add_argument("rules_file", help="Markdown file with validation rules")
    parser.add_argument("--output", required=True, help="Path to the JSON output file")
    parser.add_argument("--pattern", default="*.txt", help="Glob pattern for target files (default: *.txt)")
    parser.add_argument(
        "--provider",
        choices=["openai", "ollama", "cli"],
        default=os.getenv("AI_PROVIDER", "openai"),
        help="AI backend: openai, ollama, or cli",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("OPENAI_MODEL") or os.getenv("OLLAMA_MODEL") or "gpt-4o-mini",
        help="Model name for the selected provider",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("OPENAI_API_KEY"),
        help="OpenAI-compatible API key (or set OPENAI_API_KEY)",
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        help="OpenAI-compatible base URL (or set OPENAI_BASE_URL)",
    )
    parser.add_argument(
        "--host",
        default=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
        help="Ollama base URL (or set OLLAMA_HOST)",
    )
    parser.add_argument(
        "--ai-command",
        default=os.getenv("AI_COMMAND"),
        help="CLI command template using placeholders {prompt}, {file_path}, {rules_path}, {file_content}, {model}",
    )
    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Include hidden files when matching the target pattern",
    )
    return parser.parse_args()


def list_target_files(folder: Path, pattern: str, include_hidden: bool) -> list[Path]:
    if not folder.exists():
        raise FileNotFoundError(f"Folder not found: {folder}")
    if not folder.is_dir():
        raise NotADirectoryError(f"Path is not a directory: {folder}")

    files = []
    for match in folder.glob(pattern):
        if match.is_file() and (include_hidden or not match.name.startswith(".")):
            files.append(match)
    return sorted(files, key=lambda item: str(item.name).lower())


def read_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def validate_file_contents(file_contents: str) -> dict[str, Any]:
    """Apply the markdown rules deterministically before considering AI output."""
    found_sections: set[str] = set()
    for line in file_contents.splitlines():
        match = SECTION_HEADING_PATTERN.match(line)
        if not match:
            continue
        section = match.group("section").lower()
        found_sections.add("Attendees" if section == "attendies" else match.group("section").title())

    missing_sections = [section for section in REQUIRED_SECTIONS if section not in found_sections]
    issues: list[str] = []
    if "Action Items" in found_sections and not any(
        ACTION_ITEMS_TABLE_PATTERN.match(line) for line in file_contents.splitlines()
    ):
        issues.append("Action Items section is missing the required table header")

    return {
        "missing_sections": missing_sections,
        "issues": issues,
        "valid": not missing_sections and not issues,
    }


def build_prompt(rules_text: str, file_path: Path, file_contents: str) -> str:
    return textwrap.dedent(
        f"""You are validating a file against the provided rules.

Validation rules (Markdown):
{rules_text}

Target file: {file_path.name}

File contents:
```text
{file_contents}
```

Instructions:
1. Determine whether this file complies with all validation rules.
2. If it fails, report the missing required sections or other issues.
3. Return only valid JSON using this exact structure:
{{
  "file": "{file_path.name}",
  "valid": true,
  "missing_sections": [],
  "summary": "short summary",
  "details": "optional extra details"
}}

Do not include Markdown fences or any extra commentary. Output only JSON.
"""
    )


def call_openai(prompt: str, model: str, api_key: str | None, base_url: str) -> str:
    if not api_key:
        raise RuntimeError("OpenAI provider requires OPENAI_API_KEY or --api-key")

    url = base_url.rstrip("/") + "/chat/completions"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
    }

    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=120) as response:
        body = response.read().decode("utf-8")
    return body


def call_ollama(prompt: str, model: str, host: str) -> str:
    url = host.rstrip("/") + "/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=120) as response:
        body = response.read().decode("utf-8")
    return body


def call_cli(prompt: str, file_path: Path, rules_path: Path, file_contents: str, model: str, command_template: str) -> str:
    if not command_template:
        raise RuntimeError(
            "CLI provider requires --ai-command or AI_COMMAND. Example: 'ollama run llama3.2 --verbose'"
        )

    template = command_template
    substitutions = {
        "{prompt}": shlex.quote(prompt),
        "{file_path}": shlex.quote(str(file_path)),
        "{rules_path}": shlex.quote(str(rules_path)),
        "{file_content}": shlex.quote(file_contents),
        "{model}": shlex.quote(model),
    }
    for key, value in substitutions.items():
        template = template.replace(key, value)

    proc = subprocess.run(
        template,
        shell=True,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"CLI validation command failed: {proc.stderr.strip() or proc.stdout.strip()}")
    return proc.stdout.strip()


def extract_json_payload(raw_answer: str, file_name: str) -> dict[str, Any]:
    answer = raw_answer.strip()
    if not answer:
        return {
            "file": file_name,
            "valid": True,
            "missing_sections": [],
            "summary": "",
            "details": "",
        }

    if answer.startswith("```"):
        match = answer.strip("`")
        if match.startswith("json"):
            match = match[4:].strip()
        answer = match.strip()

    start = answer.find("{")
    end = answer.rfind("}")
    if start >= 0 and end > start:
        answer = answer[start : end + 1]

    try:
        payload = json.loads(answer)
    except json.JSONDecodeError:
        return {
            "file": file_name,
            "valid": True,
            "missing_sections": [],
            "summary": "",
            "details": answer[:2000],
        }

    if not isinstance(payload, dict):
        return {
            "file": file_name,
            "valid": True,
            "missing_sections": [],
            "summary": "",
            "details": str(payload),
        }

    payload.setdefault("file", file_name)
    payload.setdefault("valid", False)
    payload.setdefault("missing_sections", [])
    payload.setdefault("summary", "No summary returned")
    payload.setdefault("details", "")
    return payload


def parse_ai_response(raw_response: str, file_name: str) -> dict[str, Any]:
    try:
        payload_json = json.loads(raw_response)
    except json.JSONDecodeError:
        return extract_json_payload(raw_response, file_name)

    if isinstance(payload_json, dict):
        payload_json.setdefault("file", file_name)
        payload_json.setdefault("valid", False)
        payload_json.setdefault("missing_sections", [])
        payload_json.setdefault("summary", "No summary returned")
        payload_json.setdefault("details", "")
        return payload_json

    return extract_json_payload(raw_response, file_name)


def combine_validation_results(
    file_name: str,
    local_result: dict[str, Any],
    ai_result: dict[str, Any] | None,
) -> dict[str, Any]:
    """Keep rule-critical fields local and return only the public result fields."""
    missing_sections = local_result["missing_sections"]
    issues = local_result["issues"]
    if missing_sections:
        summary = f"Missing sections: {', '.join(missing_sections)}"
    elif issues:
        summary = "; ".join(issues)
    else:
        summary = (ai_result or {}).get("summary") or "All validation rules passed"

    return {
        "file": file_name,
        "missing_sections": missing_sections,
        "summary": summary,
    }


def invoke_ai(provider: str, prompt: str, file_path: Path, rules_path: Path, file_contents: str, model: str, api_key: str | None, base_url: str, host: str, command_template: str) -> dict[str, Any]:
    if provider == "openai":
        response = call_openai(prompt, model, api_key, base_url)
        parsed = json.loads(response)
        if "choices" in parsed and parsed["choices"]:
            content = parsed["choices"][0]["message"]["content"]
            return parse_ai_response(content, file_path.name)
        raise RuntimeError(f"OpenAI response did not contain content: {response[:500]}")

    if provider == "ollama":
        response = call_ollama(prompt, model, host)
        parsed = json.loads(response)
        return parse_ai_response(parsed.get("response", ""), file_path.name)

    if provider == "cli":
        response = call_cli(prompt, file_path, rules_path, file_contents, model, command_template)
        return parse_ai_response(response, file_path.name)

    raise ValueError(f"Unsupported provider: {provider}")


def write_output(output_path: Path, folder: Path, rules_path: Path, files: list[Path], results: list[dict[str, Any]]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "folder": str(folder),
        "rules_file": str(rules_path),
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "target_files": [str(file) for file in files],
        "results": results,
    }
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    folder = Path(args.folder).resolve()
    rules_path = Path(args.rules_file).resolve()
    output_path = Path(args.output).resolve()

    if not rules_path.exists():
        raise FileNotFoundError(f"Rules file not found: {rules_path}")

    files = list_target_files(folder, args.pattern, args.include_hidden)
    if not files:
        raise FileNotFoundError(f"No files matched pattern '{args.pattern}' in {folder}")

    print(f"Target files ({len(files)}):")
    for file in files:
        print(f"- {file.name}")

    rules_text = read_text_file(rules_path)
    results: list[dict[str, Any]] = []

    for file_path in files:
        file_contents = read_text_file(file_path)
        prompt = build_prompt(rules_text, file_path, file_contents)
        local_result = validate_file_contents(file_contents)
        ai_result: dict[str, Any] | None = None
        try:
            ai_result = invoke_ai(
                provider=args.provider,
                prompt=prompt,
                file_path=file_path,
                rules_path=rules_path,
                file_contents=file_contents,
                model=args.model,
                api_key=args.api_key,
                base_url=args.base_url,
                host=args.host,
                command_template=args.ai_command,
            )
        except (urllib.error.URLError, urllib.error.HTTPError, RuntimeError, ValueError) as exc:
            ai_result = {"details": f"AI validation request failed: {exc}"}

        result = combine_validation_results(file_path.name, local_result, ai_result)
        results.append(result)
        print(f"Validated {file_path.name}: {result.get('summary', 'No summary')}")

    write_output(output_path, folder, rules_path, files, results)
    print(f"Results saved to: {output_path}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pragma: no cover - CLI safety
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
