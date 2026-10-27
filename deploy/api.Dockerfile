# syntax=docker/dockerfile:1
# Build context must be the repository root:
#   docker build -f deploy/api.Dockerfile .

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @anychat/shared build \
    && pnpm --filter api exec prisma generate \
    && pnpm --filter api build

FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo /repo
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
