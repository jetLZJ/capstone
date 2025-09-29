# capstone

Brief capstone project demonstrating a small full-stack web app with a Flask API, a Vite/React frontend, SQLite storage, and an nginx proxy. The codebase is dockerized for development and deployment; the Flask service intentionally keeps the database and API reachable only on the internal Docker network and is exposed externally through the proxy.

Key components

- `flask/` — Flask backend, SQLite DB (data/app.db), DB schema (`db_schema.sql`) and helper scripts (`init_db.py`, `seed_data.py`, `migrate_db.py`, `convert_order_items.py`, `revert_order_items_created_at.py`).
- `react/` — Vite + React front-end.
- `proxy/` and `config/` — nginx proxy configuration used to expose only the proxy to the host network while keeping other services internal.

Database & data

- The application uses SQLite (`flask/data/app.db`). The schema is defined in `flask/db_schema.sql` and is initialized by `flask/init_db.py`.
- Seeders: `flask/seed_data.py` will create idempotent sample data (roles, users, menu items, orders). There is also a conversion helper `flask/convert_order_items.py` (legacy -> JSON order format) and `flask/revert_order_items_created_at.py` to revert a prior `created_at` column change if needed.

Quick local commands (PowerShell)

```powershell
# Initialize the DB (creates flask/data/app.db)
python .\flask\init_db.py

# Seed sample data (idempotent)
python .\flask\seed_data.py

# If the DB previously had a `created_at` column on order_items and you want to remove it:
python .\flask\revert_order_items_created_at.py

# Small verification (print counts and sample order_items)
python -c "import sqlite3, json;db='flask/data/app.db';c=sqlite3.connect(db);cur=c.cursor();cur.execute('SELECT count(*) FROM orders');print('orders',cur.fetchone()[0]);cur.execute('SELECT count(*) FROM order_items');print('order_rows',cur.fetchone()[0]);cur.execute('SELECT order_id, items FROM order_items LIMIT 5');rows=cur.fetchall();print('\nSample order_items rows:');\nimport sys, json;\n[print(r[0], json.loads(r[1])) for r in rows];c.close()"
```

Docker notes

- The project includes Dockerfiles and a `docker-compose.yaml`. The intended network design places the Flask app and database on an internal Docker network and only exposes the proxy (nginx) to the host — see `docker-compose.yaml` and `proxy/nginx.conf`.

