#!/bin/sh
set -e

DATA_DIR=${RQLITE_DATA_DIR:-/rqlite/file/data}
HTTP_ADDR=${RQLITE_HTTP_ADDR:-0.0.0.0:4001}
RAFT_ADDR=${RQLITE_RAFT_ADDR:-0.0.0.0:4002}
HTTP_ADV_ADDR=${RQLITE_HTTP_ADV_ADDR:-${HTTP_ADDR}}
RAFT_ADV_ADDR=${RQLITE_RAFT_ADV_ADDR:-${RAFT_ADDR}}
BOOTSTRAP_EXPECT=${RQLITE_BOOTSTRAP_EXPECT:-}
JOIN_ADDR=${RQLITE_JOIN:-}
EXTRA_ARGS=${RQLITE_EXTRA_ARGS:-}

set -- /bin/rqlited \
  -http-addr "${HTTP_ADDR}" \
  -raft-addr "${RAFT_ADDR}" \
  -http-adv-addr "${HTTP_ADV_ADDR}" \
  -raft-adv-addr "${RAFT_ADV_ADDR}"

if [ -n "${RQLITE_NODE_ID:-}" ]; then
  set -- "$@" -node-id "${RQLITE_NODE_ID}"
fi

if [ -n "${EXTRA_ARGS}" ]; then
  # shellcheck disable=SC2086
  set -- "$@" ${EXTRA_ARGS}
fi

if [ "$(ls -A "${DATA_DIR}" 2>/dev/null | wc -l)" -eq 0 ]; then
  if [ -n "${BOOTSTRAP_EXPECT}" ]; then
    set -- "$@" -bootstrap-expect "${BOOTSTRAP_EXPECT}"
  fi
  if [ -n "${JOIN_ADDR}" ]; then
    set -- "$@" -join "${JOIN_ADDR}"
  fi
fi

set -- "$@" "${DATA_DIR}"

exec "$@"
