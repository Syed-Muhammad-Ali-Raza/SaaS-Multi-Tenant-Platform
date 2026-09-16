import { Env } from "./env.validation";

export const configuration = (): Record<string, unknown> => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "3000", 10),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION ?? "15m",
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? "7d",
  },
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3001",
  cookieDomain: process.env.COOKIE_DOMAIN ?? "localhost",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
});