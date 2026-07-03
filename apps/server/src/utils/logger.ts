type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  sessionId?: string;
  component?: string;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatLine(
  level: LogLevel,
  message: string,
  ctx?: LogContext,
): string {
  const parts: string[] = [
    `[${formatTimestamp()}]`,
    `[${level.toUpperCase()}]`,
  ];
  if (ctx?.sessionId) parts.push(`[session:${ctx.sessionId}]`);
  if (ctx?.component) parts.push(`[${ctx.component}]`);
  parts.push(message);
  return parts.join(" ");
}

export function createLogger(component: string) {
  return {
    info: (message: string, ctx?: LogContext) =>
      console.log(formatLine("info", message, { ...ctx, component })),
    warn: (message: string, ctx?: LogContext) =>
      console.warn(formatLine("warn", message, { ...ctx, component })),
    error: (message: string, ctx?: LogContext) =>
      console.error(formatLine("error", message, { ...ctx, component })),
    debug: (message: string, ctx?: LogContext) =>
      console.debug(formatLine("debug", message, { ...ctx, component })),
  };
}
