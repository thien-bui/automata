COMPOSE ?= docker compose

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
	$(COMPOSE) --profile llm up -d ollama

ollama-pull:
	$(COMPOSE) --profile llm run --rm ollama ollama pull $${MODEL}
