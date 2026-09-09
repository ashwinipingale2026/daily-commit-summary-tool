import type { AppConfig } from "../../config/environment";
import type { AuthorSummaryRecord } from "../../types/report";
import type { AuthorSummaryResult, ReportSummaryPort } from "./report-generation";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_PROMPT_LENGTH = 20_000;
const MAX_RETRIES = 1;

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

function buildPrompt(author: AuthorSummaryRecord): string {
  const commits = author.commits.map((commit) => ({
    hash: commit.shortHash,
    subject: commit.subject,
    body: commit.body,
    files: commit.filesChanged.map((file) => ({
      path: file.path,
      additions: file.additions,
      deletions: file.deletions,
      binary: file.binary,
    })),
  }));

  const prompt = [
    "Summarize this developer's Git activity in 2 to 4 plain-English sentences.",
    "Use only the supplied evidence. Do not infer effort, intent, or outcomes.",
    `Author: ${author.authorName} <${author.authorEmail}>`,
    `Commits: ${JSON.stringify(commits)}`,
  ].join("\n");

  return prompt.slice(0, MAX_PROMPT_LENGTH);
}

function extractSummary(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI provider returned an invalid response");
  }

  const content = (payload as ChatCompletionResponse).choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI provider returned no summary content");
  }

  return content.trim();
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export class GitHubModelsSummary implements ReportSummaryPort {
  constructor(private readonly ai: NonNullable<AppConfig["ai"]>) {}

  async summarize(author: AuthorSummaryRecord): Promise<AuthorSummaryResult> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const response = await this.request(author);
        return {
          text: extractSummary(response),
          source: "ai",
          warning: null,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("AI provider request failed");
        if (attempt === MAX_RETRIES || !this.isRetryableError(lastError)) {
          throw lastError;
        }
      }
    }

    throw lastError ?? new Error("AI provider request failed");
  }

  private async request(author: AuthorSummaryRecord): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(this.ai.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.ai.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.ai.model,
          temperature: 0,
          messages: [
            {
              role: "system",
              content: "You are a factual software activity summarizer.",
            },
            {
              role: "user",
              content: buildPrompt(author),
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw Object.assign(new Error(`AI provider returned HTTP ${response.status}`), {
          retryable: isRetryableStatus(response.status),
        });
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && "retryable" in error) {
        throw error;
      }
      throw Object.assign(error instanceof Error ? error : new Error("AI provider request failed"), {
        retryable: false,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private isRetryableError(error: Error): boolean {
    return "retryable" in error && error.retryable === true;
  }
}
