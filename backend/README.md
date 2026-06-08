# ShopGenie Backend

```bash
uv sync --dev
uv run uvicorn app.main:app --reload --port 8000
uv run pytest -q
```

Configuration is loaded from the repository root `.env`. Copy `.env.example`
and provide `DEEPSEEK_API_KEY` before starting the API.
