FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LUMEN_NO_BROWSER=1 \
    LUMEN_SITE_ROOT=/app/site \
    PORT=3000

WORKDIR /app

RUN groupadd --system --gid 10001 lumen \
    && useradd --system --uid 10001 --gid lumen --home-dir /app --no-create-home lumen \
    && mkdir -p /app/server /app/site/assets \
    && chown -R lumen:lumen /app

COPY --chown=lumen:lumen serve.py /app/server/serve.py
COPY --chown=lumen:lumen index.html app.js store.js styles.css manus-routes.json /app/site/
COPY --chown=lumen:lumen assets/ /app/site/assets/

USER lumen:lumen
EXPOSE 3000
CMD ["python3", "/app/server/serve.py"]
