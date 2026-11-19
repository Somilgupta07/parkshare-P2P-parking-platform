import { z } from 'zod';

export const phone = z.string().trim().regex(/^\+[1-9]\d{9,14}$/, 'Phone must be in E.164 format, e.g. +919876543210');

export const requestOtpSchema = z.object({ phone });

export const verifyOtpSchema = z.object({
  phone,
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(['seeker', 'host']).default('seeker'), // only used when the account is created
});
