CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- USERS ---------------------------------------------------------------
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL UNIQUE,
  email       TEXT UNIQUE,
  name        TEXT,
  roles       TEXT[] NOT NULL DEFAULT '{seeker}',
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  kyc_status  TEXT NOT NULL DEFAULT 'none' CHECK (kyc_status IN ('none', 'pending', 'verified', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT roles_valid CHECK (roles <@ ARRAY['seeker', 'host', 'admin']::text[] AND cardinality(roles) > 0)
);
CREATE TRIGGER users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  user_agent  TEXT,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

-- LISTINGS (owned by Person 2, schema owned by Person 1) --------------
CREATE TABLE listings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  address          TEXT NOT NULL,
  location         geography(Point, 4326) NOT NULL,
  price_hour       NUMERIC(10,2) CHECK (price_hour >= 0),
  price_day        NUMERIC(10,2) CHECK (price_day >= 0),
  price_month      NUMERIC(10,2) CHECK (price_month >= 0),
  capacity         INT NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  vehicle_types    TEXT[] NOT NULL DEFAULT '{car}',
  amenities        TEXT[] NOT NULL DEFAULT '{}',
  photos           TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'inactive')),
  rejection_reason TEXT,
  avg_rating       NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count     INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX listings_location_gix ON listings USING GIST (location);
CREATE INDEX listings_host_idx ON listings (host_id);
CREATE INDEX listings_status_idx ON listings (status);
CREATE TRIGGER listings_updated BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE availability_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time   TIME NOT NULL,
  close_time  TIME NOT NULL
);
CREATE INDEX availability_listing_idx ON availability_rules (listing_id);

CREATE TABLE blackout_dates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  UNIQUE (listing_id, date)
);

-- BOOKINGS (Person 4) -------------------------------------------------
-- The exclusion constraint makes double booking impossible at DB level
-- (one booking per listing per time range; capacity > 1 needs app-level counting).
CREATE TABLE bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES listings(id),
  seeker_id   UUID NOT NULL REFERENCES users(id),
  start_ts    TIMESTAMPTZ NOT NULL,
  end_ts      TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL DEFAULT 'PENDING'
              CHECK (status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
  amount      NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  commission  NUMERIC(10,2) NOT NULL DEFAULT 0,
  qr_token    TEXT UNIQUE,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_time_valid CHECK (end_ts > start_ts),
  CONSTRAINT no_overlap EXCLUDE USING gist (listing_id WITH =, tstzrange(start_ts, end_ts) WITH &&)
    WHERE (status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN'))
);
CREATE INDEX bookings_seeker_idx ON bookings (seeker_id);
CREATE INDEX bookings_status_idx ON bookings (status);
CREATE TRIGGER bookings_updated BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          UUID NOT NULL REFERENCES bookings(id),
  razorpay_order_id   TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  amount              NUMERIC(10,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'created'
                      CHECK (status IN ('created', 'captured', 'failed', 'refunded')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_booking_idx ON payments (booking_id);
CREATE TRIGGER payments_updated BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE payouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     UUID NOT NULL REFERENCES users(id),
  booking_id  UUID NOT NULL REFERENCES bookings(id),
  amount      NUMERIC(10,2) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payouts_host_idx ON payouts (host_id);

-- REVIEWS (Person 3) --------------------------------------------------
CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL UNIQUE REFERENCES bookings(id),
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  seeker_id   UUID NOT NULL REFERENCES users(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reviews_listing_idx ON reviews (listing_id);

-- ADMIN AUDIT ---------------------------------------------------------
CREATE TABLE admin_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   UUID,
  meta        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
