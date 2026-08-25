FROM node:22.18.0-bookworm-slim

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=production

EXPOSE 3000

CMD ["pnpm", "start"]