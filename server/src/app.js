import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { pool } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { redis } from './config/redis.js';
import { openapi } from './config/swagger.js';
import { errorHandler, notFound } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import routes from './routes.js';

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.clientOrigins, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' })); // Razorpay webhook (Person 4) needs a raw body route mounted BEFORE this line
app.use(cookieParser());
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
  autoLogging: { ignore: (req) => req.url === '/health' },
}));

app.get('/health', async (req, res) => {
  const [db, cache] = await Promise.allSettled([pool.query('SELECT 1'), redis.ping()]);
  const healthy = db.status === 'fulfilled' && cache.status === 'fulfilled';
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', db: db.status, redis: cache.status });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.use('/api', apiLimiter);
app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
