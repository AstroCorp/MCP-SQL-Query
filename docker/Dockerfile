# Ejecuta los tests contra las bases del compose.
FROM node:26-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.11.1 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

CMD ["pnpm", "test"]
