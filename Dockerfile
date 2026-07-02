FROM oven/bun:1.2 AS build

WORKDIR /app
COPY package.json bun.lock ./
COPY packages/ packages/
COPY apps/server/ apps/server/
COPY tsconfig.base.json ./
RUN bun install --frozen-lockfile
RUN cd packages/protocol && bun run build
RUN cd packages/models && bun run build
RUN cd packages/storage && bun run build
RUN cd packages/tokens && bun run build
RUN cd packages/diff && bun run build
RUN cd packages/events && bun run build
RUN cd packages/sdk && bun run build
RUN cd packages/shell && bun run build
RUN cd packages/permissions && bun run build
RUN cd packages/cache && bun run build
RUN cd packages/planner && bun run build
RUN cd packages/tools && bun run build
RUN cd packages/core && bun run build
RUN cd apps/server && bun run build

FROM oven/bun:1.2-slim

WORKDIR /app
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages

EXPOSE 4096
ENV AGENT_WORKBENCH_HOST=0.0.0.0
ENV AGENT_WORKBENCH_PORT=4096

ENTRYPOINT ["bun", "run", "dist/index.js"]
