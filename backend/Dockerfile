FROM node:24-alpine AS web
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.lock.txt ./backend/requirements.lock.txt
RUN pip install --no-cache-dir -r backend/requirements.lock.txt
COPY backend/ ./backend/
COPY frontend/shared/ ./frontend/shared/
COPY --from=web /build/frontend/dist ./frontend/dist
RUN useradd --create-home appuser && mkdir -p /data && chown -R appuser:appuser /app /data
USER appuser
ENV DATABASE_URL=sqlite:////data/brandguard.db
VOLUME /data
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health')"
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
