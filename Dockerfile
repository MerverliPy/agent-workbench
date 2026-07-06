FROM oven/bun:1.2 AS build

WORKDIR /app
COPY package.json bun.lock ./
COPY packages/ packages/
COPY apps/server/ apps/server/
COPY apps/cli/ apps/cli/
COPY scripts/ scripts/
COPY tsconfig.base.json ./
RUN bun install --frozen-lockfile
RUN bash scripts/build-all.sh

FROM oven/bun:1.2-slim

WORKDIR /app
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages

EXPOSE 4096
ENV AGENT_WORKBENCH_HOST=0.0.0.0
ENV AGENT_WORKBENCH_PORT=4096

ENTRYPOINT ["bun", "run", "dist/index.js"]
