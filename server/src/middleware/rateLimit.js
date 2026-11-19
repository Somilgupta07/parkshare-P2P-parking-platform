import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';

const make = (windowMs, limit, msg) =>
  rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, handler: (req, res, next) => next(ApiError.tooMany(msg)) });

export const apiLimiter = make(15 * 60 * 1000, 300, 'Too many requests, slow down');
export const authLimiter = make(15 * 60 * 1000, 30, 'Too many auth attempts, try again later');
