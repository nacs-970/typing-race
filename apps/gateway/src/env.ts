export const PORT = Number(process.env["PORT"] ?? process.env["GATEWAY_PORT"] ?? 8080);
export const HOST = process.env["HOST"] ?? process.env["GATEWAY_HOST"] ?? "0.0.0.0";
export const ENGINE_HOST = process.env["ENGINE_HOST"] ?? "127.0.0.1";
export const ENGINE_PORT = Number(process.env["ENGINE_PORT"] ?? 8081);
export const MODE = (process.env["MODE"] ?? "split") as "unified" | "split";
export const REDIS_URL = process.env["REDIS_URL"];
export const NODE_ENV = process.env["NODE_ENV"] ?? "development";
export const LOG_LEVEL = process.env["LOG_LEVEL"] ?? (NODE_ENV === "production" ? "info" : "debug");
