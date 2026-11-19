import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';

export const notFound = (req, res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let status = 500, code = 'INTERNAL_ERROR', message = 'Something went wrong', details;

  if (err instanceof ApiError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Invalid request data';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err.code === '23505') {
    status = 409; code = 'CONFLICT'; message = 'Resource already exists';
  } else if (err.code === '23P01') {
    status = 409; code = 'BOOKING_OVERLAP'; message = 'Time slot already booked';
  } else if (err.code === '22P02') {
    status = 400; code = 'BAD_REQUEST'; message = 'Invalid identifier format';
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'BAD_JSON'; message = 'Malformed JSON body';
  }

  if (status >= 500) logger.error({ err, reqId: req.id }, 'unhandled error');
  res.status(status).json({
    success: false,
    error: { code, message, ...(details && { details }), ...(!env.isProd && status >= 500 && { stack: err.stack }) },
  });
}
