import { pino } from "pino";
import { LOG_LEVEL, NODE_ENV } from "./env.ts";

/**
 * Single pino instance for the whole server.
 * Pretty in dev (colorized, human-readable), JSON in prod (machine-parseable).
 */
export const logger = pino({
  level: LOG_LEVEL,
  ...(NODE_ENV === "production"
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }),
});