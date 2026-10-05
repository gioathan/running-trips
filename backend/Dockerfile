FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-dev.txt ./
# Dev tooling (pytest, ruff) only in the local-dev image — docker-compose.yml
# sets INSTALL_DEV=true; the prod compose file leaves it off.
ARG INSTALL_DEV=false
RUN if [ "$INSTALL_DEV" = "true" ]; then pip install -r requirements-dev.txt; else pip install -r requirements.txt; fi

COPY . .

# Run as an unprivileged user: a bug in the app or a dependency shouldn't
# hand out root inside the container. uid 1000 matches the usual host user,
# so the dev compose file's source bind-mount stays readable and writable.
RUN useradd --uid 1000 --create-home app && chown -R app:app /app
USER app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
