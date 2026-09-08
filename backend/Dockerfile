FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render (and most PaaS hosts) inject the port to bind via $PORT; fall back to
# 8000 for plain `docker run`. Shell form is required so the variable expands.
#
# Deliberately a single worker: the meta-snapshot background task is started in
# the FastAPI lifespan, so every extra worker would run its own copy of it.
EXPOSE 8000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
