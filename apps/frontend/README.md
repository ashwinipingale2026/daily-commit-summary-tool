# Daily Commit Summary frontend

## Development

Install dependencies and start the Vite development server:

```text
npm install
npm run dev
```

The application is available at `http://localhost:5173/daily-summary`.

Set `VITE_BACKEND_ORIGIN` when the backend is not running at its default local
origin of `http://localhost:3000`.

## Validation

```text
npm run typecheck
npm run build
```

The frontend is a presentation layer only. It does not connect directly to
PostgreSQL or access server filesystem paths.
