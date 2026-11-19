import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),
  OTP_SECRET: z.string().min(16, 'must be at least 16 characters'),
  OTP_TTL_SECONDS: z.coerce.number().default(300),
  OTP_DEV_ECHO: z.enum(['true', 'false']).default('false'),
  SMS_PROVIDER: z.string().default('console'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  ADMIN_PHONE: z.string().default('+919999999999'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const isProd = parsed.data.NODE_ENV === 'production';
export const env = {
  ...parsed.data,
  isProd,
  otpDevEcho: !isProd && parsed.data.OTP_DEV_ECHO === 'true',
  clientOrigins: parsed.data.CLIENT_URL.split(',').map((s) => s.trim()),
};
