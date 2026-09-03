export const HOST = process.env["HOST"] ?? "0.0.0.0";
export const PORT = Number(process.env["PORT"] ?? 8080);
export const NODE_ENV = process.env["NODE_ENV"] ?? "development";
export const LOG_LEVEL = process.env["LOG_LEVEL"] ?? (NODE_ENV === "production" ? "info" : "debug");