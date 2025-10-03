#!/bin/sh
set -eu

DEFAULT_MODEL=${OLLAMA_DEFAULT_MODEL:-phi3:mini}

log() {
  printf '[ollama-entrypoint] %s\n' "$1" >&2
}

log "starting ollama serve with default model ${DEFAULT_MODEL}"
ollama serve "$@" &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup INT TERM

log "waiting for ollama API to become ready"
until curl -fsS http://localhost:11434/api/version >/dev/null 2>&1; do
  sleep 1
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "ollama serve exited unexpectedly" >&2
    exit 1
  fi
done
log "ollama API is ready"

log "checking for default model ${DEFAULT_MODEL}"
if ! ollama list 2>/dev/null | grep -q "^${DEFAULT_MODEL}[[:space:]]"; then
  log "pulling default model ${DEFAULT_MODEL}"
  if ! ollama pull "$DEFAULT_MODEL"; then
    echo "warning: failed to pull $DEFAULT_MODEL; container will stay up but the model may be unavailable" >&2
  fi
else
  log "default model ${DEFAULT_MODEL} already present"
fi

log "warming model ${DEFAULT_MODEL}"
curl -fsS -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$DEFAULT_MODEL\",\"prompt\":\"ping\",\"stream\":false}" >/dev/null 2>&1 || true

log "entering wait state for ollama serve"
wait "$SERVER_PID"
