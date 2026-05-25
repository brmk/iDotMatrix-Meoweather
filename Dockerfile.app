FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts vitest.config.ts eslint.config.js ./
COPY src ./src
COPY dev ./dev

RUN npm run build:ui

CMD ["npm", "start"]
