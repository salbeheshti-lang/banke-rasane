FROM oven/bun:1.4.4

WORKDIR /app

COPY mini-services/api-service/package.json ./package.json
COPY mini-services/api-service/bun.lock ./bun.lock
RUN bun install --production --frozen-lockfile

COPY mini-services/api-service/index.js ./index.js
COPY mini-services/api-service/video-validation.mjs ./video-validation.mjs
COPY public/talk-shows-data.json ./talk-shows-data.json

ENV PORT=10000 \
    BANKRESANEH_HOST=0.0.0.0 \
    DB_PATH=/tmp/bankresaneh.sqlite \
    BANKRESANEH_DATA_DIR=/tmp \
    BANKRESANEH_SEED_PATH=/app/talk-shows-data.json

EXPOSE 10000
CMD ["bun", "run", "index.js"]
