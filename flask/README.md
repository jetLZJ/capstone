Flask API for Capstone
======================

Backend service powering authentication, menu management, scheduling, analytics, file uploads, and order workflows for the Capstone application.

Tech Stack
----------

- **Runtime:** Python 3.11
- **Framework:** Flask 3.x (blueprints for modular routing)
- **Auth:** Flask-JWT-Extended (JWT access/refresh tokens, revocation list)
- **Security:** Flask-Limiter (rate limiting), Flask-CORS, secure headers middleware
- **Persistence:** SQLite (`data/app.db`) via standard library `sqlite3`
- **Background tasks/utilities:** Custom helper scripts for DB initialization, seeding, and data migrations

Project Layout
--------------

```text
flask/
├── analytics.py          # Revenue & staffing metrics
├── api.py                # App factory + blueprint registration
├── auth.py               # Auth endpoints (register/login/me/...)
├── menu.py               # Menu CRUD + uploads
├── orders.py             # Authenticated order cart APIs
├── schedule.py           # Shift templates, assignments, availability
├── uploads.py            # Static asset serving helpers
├── utils.py              # DB helpers, password hashing, image validation
├── data/app.db           # SQLite database (created by init_db.py)
├── db_schema.sql         # Declarative schema for recreating the DB
├── init_db.py            # Creates tables from db_schema.sql
├── seed_data.py          # Idempotent seed for roles, users, menu, schedules
└── tests/                # Pytest suites for auth, schedule, orders, etc.
```

Local Development
-----------------

Use PowerShell 7+ on Windows or adapt commands for your shell.

```powershell
cd flask
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Initialise SQLite schema and seed demo data
python init_db.py
python seed_data.py

# Run the development server
python app.py        # exposes http://127.0.0.1:5000

# Optional: run tests
pytest
```

Environment variables (all optional during local dev):

| Name | Purpose | Default |
| --- | --- | --- |
| `SECRET_KEY` | Flask session secret | `dev-secret` |
| `JWT_SECRET_KEY` | JWT signing secret | `jwt-secret` |
| `DB_PATH` | Absolute/relative path to SQLite DB | `data/app.db` |

Running via Flask CLI
---------------------

```powershell
setx FLASK_APP app:create_app
flask --app app:create_app run --debug
```

Database Management
-------------------

- **Schema:** Update `db_schema.sql` then rerun `init_db.py` (for destructive resets) or craft migration scripts.
- **Seeding:** `seed_data.py` is idempotent—safe to run multiple times.
- **Utility scripts:**
  - `convert_order_items.py` — migrate legacy order representations to JSON column.
  - `revert_order_items_created_at.py` — roll back a previous `created_at` alteration.

API Reference
-------------

All endpoints are prefixed with `/api` when served by the main application (see blueprint registrations). Responses are JSON unless noted. Authenticated routes expect an `Authorization: Bearer <token>` header.

**Authentication (`/api/auth`)**

| Method & Path | Description | Notes |
| --- | --- | --- |
| `POST /register` | Create a new user; returns access & refresh tokens. | Payload: `email`, `password`, optional `first_name`, `last_name`, `role`. |
| `POST /login` | Exchange credentials for tokens. | Default seed users share password `password`. |
| `POST /refresh` | Exchange refresh token for a new access token. | Requires refresh token in `Authorization` header. |
| `DELETE /logout` | Revoke current access token (stores JTI). | Requires auth. |
| `GET /me` | Fetch profile for current user. | Requires auth. |
| `PATCH /me` | Update profile fields (name, phone, marketing consent, profile pic). | Requires auth. |
| `GET /status` | Service heartbeat. | No auth. |

**Example:**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@example.com","password":"password"}'
```

**Menu (`/api/menu`)**

| Method & Path | Description | Auth |
| --- | --- | --- |
| `GET /` | List menu items with optional `q` and `type` filters. | Public |
| `GET /<id>` | Fetch a single menu item. | Public |
| `POST /` | Create item (name, price, description, discount, availability, type). | Manager role |
| `PUT /<id>` | Update fields (price, availability, type, etc.). | Manager role |
| `DELETE /<id>` | Remove menu item. | Manager role |
| `POST /<id>/image` | Upload image file (multipart). | Manager role |
| `GET /types` | List category types. | Public |
| `GET /uploads/<filename>` | Serve uploaded asset. | Public |

**Orders (`/api/orders`)**

| Method & Path | Description |
| --- | --- |
| `POST /` | Create a new order for the current user; expects `items: [{item_id, qty}]`. Adjusts inventory. |
| `GET /` | List the authenticated user’s recent orders (limit query param). |
| `PATCH /<order_id>/items` | Add/merge items into an order. |
| `PATCH /<order_id>/items/<item_id>` | Adjust quantity via operations (`set`, `increment`, `decrement`). |
| `DELETE /<order_id>` | (If implemented) Cancel order — refer to source for current behaviour. |
| `POST /<order_id>/submit` | Finalise order, mark as closed (check file for behaviour). |

> 💡 These routes rely on JWT authentication. When running without Flask-JWT-Extended installed, the module returns `501` to maintain test flexibility.

**Scheduling (`/api/schedules`)**

Provides shift templates, assignments, staff availability, and coverage summaries for the React scheduler.

Key endpoints include:

- `GET /templates` – list reusable schedule templates.
- `POST /templates` – create/update templates (manager only).
- `GET /week` – fetch weekly roster with shifts and conflicts.
- `POST /week/assign` – create or update assignments.
- `GET /availability` – fetch availability per staff member.
- `POST /availability` – submit availability adjustments.

See `schedule.py` for additional routes such as conflict detection, bulk deletions, and analytics hooks.

**Analytics (`/api/analytics`)**

- `GET /summary` – Aggregated revenue, order counts, top categories, and staffing utilisation.
- `GET /staff` – Breakdown of shift hours per staff member.
- `GET /menu/performance` – Menu item popularity metrics.

**Uploads (`/api/uploads`)**

Serve static assets such as menu item images. Typically proxied via nginx and accessed by the frontend.

Testing
-------

```powershell
pytest                  # All backend tests
pytest tests/test_auth.py::test_login_flow
pytest tests/test_schedule.py -k overlap
```

Use `pytest -q` for terse output or `pytest --maxfail=1` to bail on first failure. Tests rely on the seeded database; re-run `seed_data.py` if fixtures drift.

Troubleshooting
---------------

- **Missing JWT errors?** Ensure `flask-jwt-extended` is installed and the app ran through `app.py` (which registers the extension).
- **Database locked / path issues?** Use absolute paths in `DB_PATH` or stop other processes accessing `data/app.db`.
- **Image upload fails?** Check that `static/uploads/` exists and the file extension is allowed (`utils.allowed_image`).

---

For additional integration details, consult the root [`README`](../README.md) and the frontend documentation in [`react/README.md`](../react/README.md).
