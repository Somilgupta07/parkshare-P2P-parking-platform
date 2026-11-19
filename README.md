# ParkShare - P2P Parking Marketplace (web-first)

Monorepo: `server/` (Node.js + Express + PostgreSQL/PostGIS + Redis) and `client/` (React + Vite).
This is the **Person 1 foundation**: setup, DB schema, auth (OTP + JWT + refresh rotation), RBAC, admin panel, API docs, CI.

## 1. Quick start (Docker - easiest)

```bash
git clone <repo> && cd parkshare
cp server/.env.example server/.env        # already provided as server/.env for local dev
docker compose up --build
```

- Client: http://localhost:5173
- API: http://localhost:4000/api/v1  |  Swagger docs: http://localhost:4000/api/docs  |  Health: http://localhost:4000/health
- Migrations + seed run automatically on start.

**Login (dev):** with `OTP_DEV_ECHO=true` the OTP is shown on the login screen and printed in the server logs (no SMS needed).

| Seeded user | Phone | Role |
|---|---|---|
| Admin | `+919999999999` | admin |
| Demo host | `+919000000001` | host, seeker |
| Demo seeker | `+919000000002` | seeker |

Open `/login`, enter the admin phone, click Send OTP, enter the shown OTP, and open `/admin`.

## 2. Manual start (without Docker for the apps)

Needs Node 20+, PostgreSQL 16 with PostGIS, and Redis. (You can run only `db` and `redis` through Docker: `docker compose up db redis`.)

```bash
npm run install:all
npm run migrate          # creates all tables
npm run seed             # admin + demo data
npm run dev:server       # terminal 1 -> :4000
npm run dev:client       # terminal 2 -> :5173
npm test                 # server unit tests
```

## 3. Folder structure

```
server/src
  config/        env (validated with zod), db pool, redis, logger, swagger
  middleware/    auth (authenticate, authorize), validate, rateLimit, error
  utils/         ApiError, asyncHandler, crypto, tokens, sms, pagination
  modules/       auth/  users/  admin/        <- one folder per feature
  db/            migrate.js, seed.js, migrations/001_init.sql
  routes.js      mounts every module under /api/v1
client/src
  api/client.js          axios instance with automatic token refresh
  context/AuthContext    user, login, logout, hasRole()
  components/            Layout, ProtectedRoute, Table helpers
  pages/                 Home, Login, admin/*
```

## 4. Rules for the whole team (the contract)

**API response format**
```json
{ "success": true, "data": {...}, "meta": { "total": 40, "page": 1, "limit": 20, "pages": 2 } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

**Adding a module** (example for Person 2 - listings)
1. Create `server/src/modules/listings/{listings.routes.js, listings.service.js, listings.schema.js}`.
2. Mount it in `server/src/routes.js`: `router.use('/listings', listingsRoutes)`.
3. Protect routes and validate input:
```js
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
router.post('/', authenticate, authorize('host'), validate({ body: createSchema }), asyncHandler(async (req, res) => {
  // req.user = { id, roles }
  res.status(201).json({ success: true, data: await service.create(req.user.id, req.body) });
}));
```
4. Throw `ApiError.notFound('...')`, `ApiError.forbidden()`, etc. - never send error responses by hand.
5. Add your endpoints to `server/src/config/swagger.js`.

**Frontend:** use `import { api } from '../api/client.js'` (token + refresh handled), `useAuth()` for the user, and
`<ProtectedRoute roles={['host']} />` to guard pages. Add pages in `App.jsx`.

**Database:** all schema changes go in a **new** file `server/src/db/migrations/00X_name.sql` (never edit applied ones), then `npm run migrate`. Only Person 1 merges migrations - request changes via PR.

**Git:** `main` (protected) <- `dev` <- `feat/<name>` branches. One review per PR, small PRs, CI must be green.

**Razorpay webhook (Person 4):** needs the raw body. Mount `express.raw({ type: 'application/json' })` for that one route **before** `express.json()` in `app.js`.

## 5. Auth design (how it works)

1. `POST /auth/request-otp` - 6-digit OTP stored in Redis as an HMAC (5 min TTL). 60 s cooldown, max 5 per hour.
2. `POST /auth/verify-otp` - max 5 wrong attempts, then creates the user if new and returns an **access token (JWT, 15 min)** in JSON and a **refresh token** in an httpOnly cookie.
3. `POST /auth/refresh` - rotates the refresh token (stored hashed in DB). Reusing an old token revokes all sessions of that user.
4. Roles live in the JWT (`seeker`, `host`, `admin`). Blocking a user sets a Redis flag, so it applies immediately, and revokes their refresh tokens.
5. Admin API (`/admin/*`): stats, users (search/block), listings (approve/reject with reason), bookings. Every admin action is written to `admin_audit_logs`.

## 6. Production checklist

- [ ] Generate strong `JWT_ACCESS_SECRET` and `OTP_SECRET`; set `NODE_ENV=production`, `OTP_DEV_ECHO=false`.
- [ ] Implement a real SMS provider in `server/src/utils/sms.js` (MSG91 / Twilio) and set `SMS_PROVIDER`. With `console` the OTP is only logged.
- [ ] Set `CLIENT_URL` to the real frontend origin(s). If the frontend (Vercel) and API (Render) are on different domains, use `COOKIE_SAMESITE=none` (HTTPS required) and set `VITE_API_URL`.
- [ ] Remove or change seeded demo users and the admin phone (`ADMIN_PHONE`).
- [ ] Managed Postgres with PostGIS + Redis, daily DB backups, HTTPS everywhere.
- [ ] Move the global rate limiter to a Redis store when running more than one API instance.

## 7. Known limits (by design for the MVP)

- One booking per listing per time range (DB exclusion constraint). For `capacity > 1`, Person 4 must count overlapping bookings in a transaction.
- Roles in a JWT can be up to 15 minutes stale after an admin change (blocking is instant).
- Admin cannot create other admins from the UI; promote via SQL: `UPDATE users SET roles = '{admin}' WHERE phone = '+91...';`
