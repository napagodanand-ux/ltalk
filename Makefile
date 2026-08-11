.PHONY: help lint typecheck test format install dev clean build-appimage

help:
	@echo "LTalk — Available targets:"
	@echo "  make install      Install runtime dependencies"
	@echo "  make dev          Install with dev + gui extras"
	@echo "  make lint         Run ruff linter"
	@echo "  make format       Auto-format code with ruff"
	@echo "  make typecheck    Run mypy type checker"
	@echo "  make test         Run pytest"
	@echo "  make all          lint + typecheck + test"
	@echo "  make clean        Remove build artifacts"
	@echo "  make build-appimage  Build AppImage (requires docker)"

install:
	pip install -e .

dev:
	pip install -e ".[gui,dev]"

lint:
	ruff check .

format:
	ruff format .

typecheck:
	mypy ltalk_core/ ltalk_app/ ltalkd/

test:
	pytest tests/ -v

all: lint typecheck test

clean:
	rm -rf build/ dist/ target/ *.egg-info __pycache__ ltalk_app/__pycache__ ltalk_core/__pycache__ ltalkd/__pycache__
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

build-appimage:
	bash scripts/build-appimage.sh
