# Capstone Platform

Full‑stack restaurant management platform that combines a Flask API, a Vite/React frontend, SQLite storage, and an nginx reverse proxy. Everything is container‑friendly (Docker Compose) while remaining easy to develop locally with native tooling.

> 📚 Module documentation
>
> - [`README.md`](./flask/README.md) in `flask/` – backend tech stack, setup, and full API reference.
> - [`README.md`](./react/README.md) in `react/` – frontend architecture, tooling, and developer workflow.

## Architecture Overview

| Component | Tech | Purpose |
| --- | --- | --- |
| Proxy (`proxy/`, `config/`) | nginx | Terminates HTTP, forwards traffic to Flask/React services, and shields internal network resources. |
| API (`flask/`) | Python 3.11, Flask, SQLite, JWT | Provides authentication, menu management, scheduling, analytics, and order workflows. |
| Frontend (`react/`) | React 18, Vite, React Router, TailwindCSS | Dashboard UI, schedule planner, menu editor, analytics surface for managers/staff. |
| Data | SQLite (`flask/data/app.db`) | Lightweight relational storage seeded with demo users, menu items, schedules, and analytics data. |

![Architecture diagram](docs/media/architecture-overview.png) <!-- Optional: replace/remove if diagram unavailable -->

### Key Features

- Role‑aware authentication (Admin, Manager, Staff, User) with JWT tokens and revocation list.
- Rich scheduling UI with drag & drop, overlap detection, and coverage summaries.
- Menu management (CRUD, image uploads, categories, availability toggles, search/filter).
- Orders API + React panels for active cart and order history.
- Analytics dashboard summarising revenue, staffing, and popular items.

## Tech Stack

| Layer | Primary Libraries |
| --- | --- |
| Backend | Flask, Flask-JWT-Extended, Flask-Limiter, Flask-CORS, SQLite3, Pillow (image handling) |
| Frontend | React, Vite, React Router, TailwindCSS, React DnD, React Query-style hooks (custom), Axios-based HTTP client |
| Tooling | Docker/Docker Compose, Pytest, React Testing Library + Vitest, ESLint, Prettier |

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+ (includes npm)
- Optional: Docker Desktop (for containerised workflows)
- PowerShell (on Windows) or any POSIX shell

### 1. Backend (Flask)

```powershell
cd flask
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python init_db.py
python seed_data.py
python app.py  # or: flask run --app app:create_app --debug
```

See [`flask/README.md`](./flask/README.md) for API usage, environment variables, and test commands.

### 2. Frontend (React)

```powershell
cd react
npm install
npm run dev
```

Visit <http://localhost:5173> (Vite default) while the Flask API runs on <http://localhost:5000>.

Additional frontend details live in [`react/README.md`](./react/README.md).

### 3. Full stack via Docker Compose

```powershell
docker compose up --build
```

- nginx proxy: <http://localhost:8080> (public entry point)
- React dev server runs hot-reload behind the proxy
- Flask API and SQLite are isolated on the docker network (`app-network`)

## Testing & Quality

| Target | Command |
| --- | --- |
| Backend unit/integration tests | `pytest` (run from `flask/` with virtualenv active) |
| Frontend unit tests | `npm run test` (from `react/`) |
| Frontend linting | `npm run lint` |
| API smoke script | `python tools/api_smoke.py` |

CI Recommendations:

1. Run backend lint/tests (e.g., Ruff + Pytest) on each push.
2. Run `npm ci` + `npm run lint` + `npm run build` for frontend.
3. Optional: dockerised integration smoke using `docker compose up --build` in a GitHub Actions job.

## Project Layout

```text
├── docker-compose.yaml
├── flask/                  # API service (see module README)
├── react/                  # Vite/React frontend (see module README)
├── proxy/                  # nginx Dockerfile + config
├── docs/                   # Architecture notes, plans, assets
├── scripts/                # Utility scripts (linting, API checks)
├── standup/                # Daily standup notes (auto-generated)
└── tools/                  # CLI helpers (e.g. api_smoke.py)
```

## Deployment Notes

- Docker images are defined per service (`flask/Dockerfile`, `react/Dockerfile`, `proxy/Dockerfile`).
- For hosted deployments, pair Docker builds with a registry (GHCR/ECR) and orchestrate via Fly.io, Railway, or Render.
- Proxy expects Flask service hostname `flask` and frontend `react` inside the Compose/Orchestrator network.

Refer to [`docs/backend-fault-tolerance-plan.md`](./docs/backend-fault-tolerance-plan.md) for HA considerations and failover architecture ideas.

---

Maintained by the Capstone team. Contributions welcome—open an issue or submit a PR with clean lint/test runs.

