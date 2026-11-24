FROM oven/bun:1.4.4

WORKDIR /app

# Render builds with the repository root as Docker context.
COPY mini-services/api-service/package.json ./package.json
RUN bun install --production

COPY mini-services/api-service/index.js ./index.js
COPY mini-services/api-service/video-validation.mjs ./video-validation.mjs
COPY public/talk-shows-data.json ./talk-shows-data.json

# Bind publicly inside the Render container and seed the existing baseline archive.
ENV PORT=10000
ENV BANKRESANEH_HOST=0.0.0.0
ENV BANKRESANEH_SEED_PATH=/app/talk-shows-data.json

EXPOSE 10000

CMD ["bun", "run", "index.js"]
