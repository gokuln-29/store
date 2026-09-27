/**
 * Structured logging: one JSON object per line on stdout/stderr, ready for any log collector
 * (Vercel, Docker, CloudWatch…). Errors are also reported to Sentry when SENTRY_DSN is set.
 * Never log secrets, OTPs, full card/UPI data or complete addresses.
 */
type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel =
  (process.env.LOG_LEVEL as Level) || (process.env.NODE_ENV === "production" ? "info" : "debug");

function serializeError(error: unknown): Fields {
  if (error instanceof Error) {
    return {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack?.split("\n").slice(0, 8).join("\n"),
      },
    };
  }
  return error === undefined ? {} : { error: String(error) };
}

function write(level: Level, scope: string, msg: string, fields: Fields = {}, error?: unknown) {
  if (ORDER[level] < ORDER[minLevel in ORDER ? minLevel : "info"]) return;
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    scope,
    msg,
    ...fields,
    ...serializeError(error),
  });
  if (level === "error" || level === "warn") process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
  if (level === "error" && process.env.SENTRY_DSN) {
    void import("@sentry/nextjs").then((Sentry) =>
      Sentry.captureException(error ?? new Error(msg), { tags: { scope }, extra: fields }),
    );
  }
}

/** A logger for one area of the app, e.g. logger("payments"). */
export function logger(scope: string) {
  return {
    debug: (msg: string, fields?: Fields) => write("debug", scope, msg, fields),
    info: (msg: string, fields?: Fields) => write("info", scope, msg, fields),
    warn: (msg: string, fields?: Fields, error?: unknown) =>
      write("warn", scope, msg, fields, error),
    error: (msg: string, fields?: Fields, error?: unknown) =>
      write("error", scope, msg, fields, error),
  };
}
