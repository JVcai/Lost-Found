FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY admin/package.json admin/package.json
COPY mobile/package.json mobile/package.json
COPY packages/shared packages/shared
RUN --mount=type=secret,id=network_ca \
    if [ -f /run/secrets/network_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/network_ca; fi; \
    npm ci --ignore-scripts --workspace=backend --workspace=@lostnet/shared --include-workspace-root=false --no-audit --no-fund
COPY backend/src backend/src
COPY backend/tsconfig.json backend/tsconfig.json
RUN npm run build -w @lostnet/shared && npm run build -w backend

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY admin/package.json admin/package.json
COPY mobile/package.json mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=secret,id=network_ca \
    if [ -f /run/secrets/network_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/network_ca; fi; \
    npm ci --omit=dev --ignore-scripts --workspace=backend --workspace=@lostnet/shared --include-workspace-root=false --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/packages/shared/dist packages/shared/dist
USER node
WORKDIR /app/backend
EXPOSE 3000
CMD ["node","dist/main.js"]
