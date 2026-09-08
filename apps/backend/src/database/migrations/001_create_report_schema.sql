CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_path text NOT NULL CHECK (btrim(repository_path) <> ''),
  repository_name text NOT NULL CHECK (btrim(repository_name) <> ''),
  branch_name text NOT NULL CHECK (btrim(branch_name) <> ''),
  head_commit_hash text NOT NULL CHECK (btrim(head_commit_hash) <> ''),
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  scoring_config jsonb NOT NULL CHECK (jsonb_typeof(scoring_config) = 'object'),
  generated_at timestamptz NOT NULL,
  total_commits integer NOT NULL CHECK (total_commits > 0),
  contributing_authors integer NOT NULL CHECK (contributing_authors > 0),
  output_path text,
  generation_status text NOT NULL CHECK (generation_status IN ('completed', 'partial_success')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT reports_window_order CHECK (window_start < window_end)
);

CREATE TABLE author_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_email text NOT NULL DEFAULT '',
  commit_count integer NOT NULL CHECK (commit_count > 0),
  files_touched integer NOT NULL CHECK (files_touched >= 0),
  lines_added integer NOT NULL CHECK (lines_added >= 0),
  lines_removed integer NOT NULL CHECK (lines_removed >= 0),
  activity_score numeric NOT NULL CHECK (activity_score >= 0),
  activity_level text NOT NULL CHECK (activity_level IN ('low', 'medium', 'high')),
  summary_text text NOT NULL CHECK (btrim(summary_text) <> ''),
  summary_source text NOT NULL CHECK (summary_source IN ('ai', 'fallback')),
  summary_status text NOT NULL CHECK (summary_status = 'available'),
  summary_warning text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT author_summaries_identity_unique UNIQUE (report_id, author_name, author_email),
  CONSTRAINT author_summaries_name_nonempty CHECK (btrim(author_name) <> '')
);

CREATE TABLE commit_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_summary_id uuid NOT NULL REFERENCES author_summaries(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  commit_hash text NOT NULL CHECK (btrim(commit_hash) <> ''),
  short_hash text NOT NULL CHECK (btrim(short_hash) <> ''),
  author_name text NOT NULL,
  author_email text NOT NULL DEFAULT '',
  author_timestamp timestamptz NOT NULL,
  committer_timestamp timestamptz NOT NULL,
  subject text NOT NULL,
  body text,
  files_changed jsonb NOT NULL
    CHECK (jsonb_typeof(files_changed) = 'array'),
  "binary" boolean NOT NULL DEFAULT false,
  file_count integer NOT NULL CHECK (file_count >= 0),
  lines_added integer NOT NULL CHECK (lines_added >= 0),
  lines_removed integer NOT NULL CHECK (lines_removed >= 0),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT commit_evidence_report_hash_unique UNIQUE (report_id, commit_hash)
);

CREATE TABLE report_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  author_summary_id uuid REFERENCES author_summaries(id) ON DELETE SET NULL,
  code text NOT NULL CHECK (btrim(code) <> ''),
  message text NOT NULL CHECK (btrim(message) <> ''),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX reports_generated_at_idx
  ON reports (generated_at DESC);

CREATE INDEX reports_repository_branch_window_idx
  ON reports (repository_path, branch_name, window_end DESC);

CREATE INDEX author_summaries_report_score_idx
  ON author_summaries (report_id, activity_score DESC);

CREATE INDEX commit_evidence_author_timestamp_idx
  ON commit_evidence (author_summary_id, author_timestamp DESC);
