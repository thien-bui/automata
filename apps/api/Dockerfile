# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
# Install build essentials for native dependencies if required
RUN apk add --no-cache python3 make g++
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/types/package.json ./packages/types/package.json
RUN npm install --include=dev

FROM deps AS build
COPY . .
RUN npm run --workspace @automata/types build
RUN npm run --workspace @automata/api build

FROM deps AS production-deps
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY apps/api/package.json ./package.json
EXPOSE 4000
CMD ["node", "dist/apps/api/src/server.js"]
