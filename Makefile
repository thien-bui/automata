COMPOSE ?= docker compose
OLLAMA_DEFAULT_MODEL ?= phi3:mini
MODEL ?= $(OLLAMA_DEFAULT_MODEL)

.PHONY: compose-build compose-up compose-down compose-logs

compose-build:
	$(COMPOSE) build

compose-up:
	$(COMPOSE) up

compose-down:
	$(COMPOSE) down

compose-logs:
	$(COMPOSE) logs -f

.PHONY: ollama-up ollama-pull

ollama-up:
	$(COMPOSE) --profile llm up -d ollama open-webui

ollama-pull:
	$(COMPOSE) --profile llm run --rm ollama ollama pull $${MODEL}
