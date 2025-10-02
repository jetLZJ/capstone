#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose-ha.yaml}
BASE_URL=${BASE_URL:-http://localhost:8080}
API_HEALTH_ENDPOINT=${API_HEALTH_ENDPOINT:-/health}
PROXY_HEALTH_ENDPOINT=${PROXY_HEALTH_ENDPOINT:-/healthz}

cleanup() {
    EXIT_CODE=$?
    if [[ "${PRESERVE_ENVIRONMENT:-false}" != "true" ]]; then
        docker compose -f "${COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true
    fi
    exit ${EXIT_CODE}
}
trap cleanup EXIT

log() {
    printf '\n[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"
}

retry() {
    local attempts=$1
    shift
    local delay=${RETRY_DELAY:-3}

    for ((i=1; i<=attempts; i++)); do
        if "$@"; then
            return 0
        fi
        log "Attempt ${i}/${attempts} failed. Retrying in ${delay}s..."
        sleep "${delay}"
    done
    return 1
}

log "Launching high-availability stack with ${COMPOSE_FILE}"
docker compose -f "${COMPOSE_FILE}" up -d --wait

log "Verifying proxy health"
retry 5 curl -sf "${BASE_URL}${PROXY_HEALTH_ENDPOINT}" >/dev/null

log "Probing primary Flask service via proxy"
retry 5 curl -sf "${BASE_URL}${API_HEALTH_ENDPOINT}" >/dev/null

log "Stopping primary Flask container to trigger failover"
docker compose -f "${COMPOSE_FILE}" stop flask-primary

log "Ensuring secondary service takes over"
retry 10 curl -sf "${BASE_URL}${API_HEALTH_ENDPOINT}" >/dev/null

log "Restarting primary service for completeness"
docker compose -f "${COMPOSE_FILE}" start flask-primary
retry 10 curl -sf "${BASE_URL}${API_HEALTH_ENDPOINT}" >/dev/null

log "Failover smoke test completed successfully"
