# Capstone Platform

Full‑stack restaurant management platform that combines a Flask API, a Vite/React frontend, SQLite storage, and an nginx reverse proxy. Everything is container‑friendly (Docker Compose) while remaining easy to develop locally with native tooling.

> 📚 Module documentation
>
> - [`README.md`](./flask/README.md) in `flask/` – backend tech stack, setup, and full API reference.
> - [`README.md`](./react/README.md) in `react/` – frontend architecture, tooling, and developer workflow.

## Architecture Overview

| Component | Tech | Purpose |
| --- | --- | --- |
| Proxy (`proxy/`, `config/`) | nginx | Terminates HTTP, forwards traffic to Flask/React services, performs active health checks, and shields internal network resources. |
| API (`flask/`) | Python 3.11, Flask, JWT | Runs as an active/standby pair of containers that share a read/write connection pool to rqlite. Provides authentication, menu management, scheduling, analytics, and order workflows. |
| Frontend (`react/`) | React 18, Vite, React Router, TailwindCSS | Dashboard UI, schedule planner, menu editor, analytics surface for managers/staff. |
| Data | rqlite 3-node cluster (`rqlite-1/2/3`) | Distributed SQLite replica set seeded with demo users, menu items, schedules, and analytics data. |


```mermaid
graph TD
    A[Browser / Client] --> B[nginx proxy (port 8080)]
    B --> C["React frontend\nVite dev server / static bundle"]
    B --> D["Flask API replicas\nPrimary + Secondary"]
    D --> E[(rqlite cluster (3 nodes))]
    D --> F[Static uploads / assets]
    C -->|API calls| D
```

### Key Features

- Role‑aware authentication (Admin, Manager, Staff, User) with JWT tokens and revocation list.
- Rich scheduling UI with drag & drop, overlap detection, open-shift fill, and coverage summaries.
- Menu management (CRUD, image uploads, categories, availability toggles, search/filter).
- Orders API + React panels for active cart and order history.
- Analytics dashboard summarising revenue, staffing, and popular items.
- Built-in fault tolerance: dual Flask API replicas behind nginx and a 3-node rqlite cluster with automatic leader election.
- Staff dashboard with shift notifications, weekly coverage metrics, and acknowledgement workflow.

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

## Recent Enhancements (October 2025)

- **Scheduling pipeline:** `/api/schedules/week` now returns open-shift metadata, coverage counts, and conflict hints consumed by the drag-and-drop calendar.
- **Staff notifications:** New `/api/schedules/notifications` endpoints seed and acknowledge shift alerts surfaced inside the Staff dashboard.
- **Dashboard UX:** Staff landing page highlights next shifts, coverage totals, and real-time notifications with acknowledgement actions.
- **Test coverage:** Extended `tests/test_schedule.py` exercises notifications, coverage math, and conflict resolution for the new APIs.

## Fault Tolerance Topology

```text
Browser / API client
          │
          ▼
    nginx proxy (8080)
          │  └── passive health checks + failover routing
          ▼
┌───────────────────────────┐
│ Flask API replicas        │
│   • flask-primary (active)│
│   • flask-secondary (warm)│
└────────────┬──────────────┘
                 │
                 ▼
    rqlite replica set (3 nodes)
    • rqlite-1 (leader capable)
    • rqlite-2 (follower)
    • rqlite-3 (follower)
```

- **Proxy resiliency** – nginx probes each Flask replica (`/health`) and automatically retries failed requests.
- **Stateless API replicas** – both Flask containers mount the same image and connect to rqlite; JWTs allow any replica to serve a request.
- **Durable data layer** – rqlite handles consensus and leader election, so writes continue as long as a majority of nodes remain.

## Demonstrating Fault Tolerance

1. **Start the full stack**

    ```powershell
    docker compose up -d --build
    ```

2. **Seed and verify data** – log into the app at <http://localhost:3000> and create an order or update a schedule to generate traffic.
3. **Simulate an API failure**

    ```powershell
    docker compose stop flask-primary
    ```

    Reload the UI or hit `Invoke-WebRequest http://localhost:8080/api/menu` to confirm responses continue via `flask-secondary`.
4. **Bring the replica back**

    ```powershell
    docker compose start flask-primary
    ```

    nginx will automatically resume routing once the health check passes.
5. **Simulate a data-node outage** – stop one follower (e.g. `docker compose stop rqlite-3`) and repeat an order workflow. rqlite will keep accepting writes because a quorum (2 of 3) is available.
6. **Recover the cluster** – restart the node (`docker compose start rqlite-3`). The restarted node will catch up automatically.

Document screenshots or CLI output while performing the steps above to showcase the self-healing behaviour.

---

Maintained by the Capstone team. Contributions welcome—open an issue or submit a PR with clean lint/test runs.

