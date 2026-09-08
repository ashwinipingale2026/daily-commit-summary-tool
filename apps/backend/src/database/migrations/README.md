# Database migrations

Migrations are versioned SQL files under this directory.

- `NNN_description.sql` applies a migration.
- `NNN_description.down.sql` rolls the migration back.

Apply `001_create_report_schema.sql` to a clean PostgreSQL 15 database. Run the matching `.down.sql` only when intentionally resetting the local schema. Application code is responsible for validating that report count snapshots match their persisted child rows within its transaction.
