import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

// Add a real provider (MSG91 / Twilio / Fast2SMS) here and set SMS_PROVIDER in .env.
export async function sendSms(phone, message) {
  if (env.SMS_PROVIDER === 'console') {
    logger.info({ phone, message }, 'SMS (console provider - not actually sent)');
    return;
  }
  throw new Error(`SMS provider "${env.SMS_PROVIDER}" is not implemented. Add it in src/utils/sms.js`);
}
