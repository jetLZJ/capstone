# Backend Fault Tolerance Plan

## Goals

- Keep the backend API available even if a single application container fails.
- Maintain data consistency between primary and redundant servers.
- Allow the proxy/load balancer to shift traffic automatically when the primary node is down.

## Overview Architecture

1. **Replicated Postgres datastore**
   - Replace SQLite with a Postgres primary/replica pair using streaming replication.
   - Use Docker services `postgres-primary` and `postgres-replica` (or a managed HA Postgres offering).
   - Manage schema via migrations (e.g., Alembic/Flask-Migrate) rather than copying DB files.

2. **Redundant Flask application nodes**
   - Run two identical Flask/Gunicorn containers (`flaskserver-primary`, `flaskserver-secondary`) pointed at Postgres.
   - Share stateless JWT auth; store uploaded assets in shared object storage (S3/MinIO) instead of container disks.

3. **Health-aware proxy/load balancer**
   - Replace or extend the current nginx proxy with active health checks (or adopt HAProxy/Traefik).
   - Configure automatic failover: if the primary app or DB is unhealthy, route requests to the standby node.

4. **Operational safeguards**
   - Centralize secrets via Docker secrets or environment manager.
   - Add monitoring/alerting (Prometheus/Grafana or similar) and documented runbooks for failover.
   - Automate backups via WAL archiving or pgBackRest.

## Detailed Steps

### 1. Stand Up Postgres Primary/Replica

- Create Docker services:

  ```yaml
  services:
    postgres-primary:
      image: postgres:16
      environment:
        POSTGRES_USER: capstone
        POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
        POSTGRES_DB: capstone
        PGDATA: /var/lib/postgresql/data/pgdata
        WAL_LEVEL: replica
        MAX_WAL_SENDERS: 10
        ARCHIVE_MODE: "on"
        ARCHIVE_COMMAND: "cp %p /var/lib/postgresql/wal/%f"
      volumes:
        - postgres_primary_data:/var/lib/postgresql/data
        - postgres_wal_archives:/var/lib/postgresql/wal
      healthcheck: ...

    postgres-replica:
      image: postgres:16
      environment:
        POSTGRES_USER: capstone
        POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
        POSTGRES_DB: capstone
        PGDATA: /var/lib/postgresql/data/pgdata
        PRIMARY_CONNINFO: "host=postgres-primary port=5432 user=replicator password=${REPLICATOR_PASSWORD}"
        PRIMARY_SLOT_NAME: "capstone_slot"
      depends_on:
        - postgres-primary
      volumes:
        - postgres_replica_data:/var/lib/postgresql/data
        - postgres_wal_archives:/var/lib/postgresql/wal
      healthcheck: ...
  ```

- Consider adding Patroni/repmgr for automatic leader election, or leverage managed Postgres.

### 2. Migrate the Flask App to Postgres

- Introduce `DATABASE_URL` env var (SQLAlchemy/psycopg connection string) for both app containers.
- Write migration script to port current SQLite schema and seed data into Postgres.
- Update `utils.get_db()` (or equivalent) to use SQLAlchemy engine/connection pool pointing to Postgres.

### 3. Run Redundant Flask Containers

- Sample Docker Compose snippet:

  ```yaml
  flaskserver-primary:
    build: ./flask
    command: gunicorn app:create_app --bind 0.0.0.0:5000 --workers 4
    environment:
      DATABASE_URL: postgresql://capstone:${POSTGRES_PASSWORD}@postgres-primary:5432/capstone
    depends_on:
      - postgres-primary
    healthcheck: ...

  flaskserver-secondary:
    build: ./flask
    command: gunicorn app:create_app --bind 0.0.0.0:5000 --workers 4
    environment:
      DATABASE_URL: postgresql://capstone:${POSTGRES_PASSWORD}@postgres-replica:5432/capstone
    depends_on:
      - postgres-replica
    healthcheck: ...
  ```

- Ensure both containers share secrets and access to object storage for uploaded images.
- Use JWT for sessions (already implemented) to avoid sticky sessions.

### 4. Configure Proxy with Failover

- **Option A — HAProxy**:

  ```haproxy
  frontend http_front
      bind *:8080
      default_backend flask_pool

  backend flask_pool
      option httpchk GET /health
      server flask_primary flaskserver-primary:5000 check inter 5s fall 2 rise 3
      server flask_secondary flaskserver-secondary:5000 check backup inter 5s fall 2 rise 3
  ```

- **Option B — nginx** with `upstream` and health checks (requires extra module or use nginx Plus/Traefik).
- Serve static assets from object storage or a shared CDN bucket so both nodes can reach them.

### 5. Monitoring, Backups, and Runbooks

- Export container and DB metrics (Prometheus, Grafana dashboards) and set alerts for failover events.
- Automate backups via WAL archiving or pgBackRest, verify restore process regularly.
- Document failover steps: promoting replica, updating connection strings, rolling back if needed.

### 6. Testing Plan

- Write integration tests that run against Postgres to confirm app compatibility.
- Simulate failover: stop `flaskserver-primary` and ensure traffic moves to secondary; repeat for Postgres primary.
- Load test to confirm failover latency and steady-state performance.

## Deliverables Checklist

- [ ] Docker Compose (or orchestration manifests) updated with Postgres HA and dual Flask services.
- [ ] Flask configuration refactored to use `DATABASE_URL` and Postgres migrations.
- [ ] Proxy configuration checked into repo with health checks and failover logic.
- [ ] Infrastructure documentation + runbooks (failover, backup, restore).
- [ ] Monitoring/alerting dashboards defined.
- [ ] Failover test results recorded.

---

_This plan was generated on 2025-10-01 (branch `feature/user-page-enhancement`) to guide future implementation of backend fault tolerance and data replication._
