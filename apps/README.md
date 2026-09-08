# Local PostgreSQL

Copy the repository `.env.example` to `.env`, replace the placeholder database password, and start PostgreSQL from the repository root:

```text
docker compose -f apps/docker-compose.yml up -d
```

The service exposes PostgreSQL on `localhost:5432` by default and uses the connection string configured by `DATABASE_URL`.

Check readiness with:

```text
docker compose -f apps/docker-compose.yml ps
```

The `daily-commit-summary-postgres` named volume preserves local data. Remove it only when a clean local database is required:

```text
docker compose -f apps/docker-compose.yml down -v
```
