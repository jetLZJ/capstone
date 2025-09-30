Flask API for Capstone
======================

This folder contains a minimal REST API that integrates with the existing
SQLite schema in `db_schema.sql`. It provides JWT authentication, menu CRUD,
image upload, basic rate limiting, CORS and secure headers.

Quick start (Windows, PowerShell):

1. Create a virtualenv and install requirements

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Initialize the DB and seed data (these scripts exist in this folder):

```powershell
python init_db.py
python seed_data.py
```

3. Run the API

```powershell
python api.py
```

4. Test the ping endpoint

```powershell
curl http://127.0.0.1:5000/ping
```

Notes
- Passwords in the seed data are placeholders; registration endpoint stores
  users but seed data users do not have a password set. For testing login,
  use `email` from seeded users and password `password` (demo only).
