import { pino } from "pino";
import { LOG_LEVEL, NODE_ENV } from "./env.ts";

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
