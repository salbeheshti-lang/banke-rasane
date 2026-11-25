FROM oven/bun:1.4.4

WORKDIR /app

# Build context is the repository root (Render dockerContext: ".").
COPY mini-services/api-service/package.json ./package.json
RUN bun install --production

COPY mini-services/api-service/index.js ./index.js
COPY mini-services/api-service/video-validation.mjs ./video-validation.mjs
COPY public/talk-shows-data.json ./talk-shows-data.json

# Render must be able to reach the Bun server from outside the container.
ENV PORT=10000
ENV BANKRESANEH_HOST=0.0.0.0
ENV BANKRESANEH_SEED_PATH=/app/talk-shows-data.json

EXPOSE 10000

CMD ["bun", "run", "index.js"]
