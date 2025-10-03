# Ollama Local Application Plan

## 1. Goals & Constraints
- Run Ollama locally using the existing Docker Compose stack so other Automata services can consume `http://ollama:11434` on the same network.
- Keep scope limited to container orchestration and configuration—no frontend experience or additional API routes are required now.
- Preserve Node 20 tooling compatibility and avoid introducing dependencies outside the current workspace tooling.

## 2. Prerequisites & Context Check
1. Confirm the repo root matches `/home/laevateinn/Downloads/projects/automata` and Docker Compose already defines the `automata` bridge network.
2. Ensure the host has Docker Engine ≥ 24 and Compose plugin installed (LLM can assume success unless shell command fails).
3. Verify that `deploy/` is writable; create `deploy/ollama` directory for persisted models if it does not yet exist.

## 3. Implementation Steps (LLM Execution Guide)
1. **Prepare Persistence Directory**
   - Command: `mkdir -p deploy/ollama`
   - Add `.gitkeep` inside the directory if it is empty to keep the folder under version control.

2. **Amend Root `.gitignore`** (only if `deploy/ollama` is not yet covered)
   - Append the line `deploy/ollama/*` followed by `!deploy/ollama/.gitkeep` to prevent model blobs from being committed.

3. **Extend `docker-compose.yml`**
   - Insert a new service block after existing services:
```yaml
  ollama:
    image: ollama/ollama:latest
    profiles:
      - llm
    ports:
      - "11434:11434"
    volumes:
      - ./deploy/ollama:/root/.ollama
    environment:
      - OLLAMA_KEEP_ALIVE=5m
    healthcheck:
      test: ["CMD-SHELL", "curl -fsSL http://localhost:11434/api/tags || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 15s
    networks:
      - automata
```
   - Reuse the existing `automata` network section; no new networks required.

4. **Document Makefile Helpers (optional but recommended)**
   - If the root `Makefile` exists, add:
```make
ollama-up:
\tdocker compose --profile llm up -d ollama

ollama-pull:
\tdocker compose --profile llm run --rm ollama ollama pull $${MODEL}
```
   - These targets standardize bringing the Ollama container up and pulling models.

5. **Provide Runtime Instructions**
   - Update `AGENTS.md` or create `docs/ollama.md` with a short note covering:
     - `docker compose --profile llm up -d ollama`
     - `docker compose --profile llm run --rm ollama ollama pull llama3.1:8b`
     - Reminder that other services can reach `http://ollama:11434` via Docker DNS (`ollama`).

## 4. Verification Checklist
- `docker compose --profile llm up -d ollama` completes without errors and healthcheck turns `healthy`.
- `docker compose ps` lists the Ollama container on the `automata` network.
- `curl http://localhost:11434/api/tags` returns JSON after the container is healthy.
- Stopping and restarting the stack retains downloaded models by virtue of the `deploy/ollama` volume.

## 5. Quickstart Commands
1. `mkdir -p deploy/ollama && touch deploy/ollama/.gitkeep`
2. `docker compose --profile llm up -d ollama`
3. `docker compose --profile llm run --rm ollama ollama pull llama3.1:8b`
4. `curl http://localhost:11434/api/generate -d '{"model":"llama3.1:8b","prompt":"Hello"}'`
