import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

async function upsertUser(phone, name, roles) {
  const { rows } = await pool.query(
    `INSERT INTO users (phone, name, roles) VALUES ($1, $2, $3)
     ON CONFLICT (phone) DO UPDATE SET roles = EXCLUDED.roles, name = COALESCE(users.name, EXCLUDED.name)
     RETURNING id`,
    [phone, name, roles],
  );
  return rows[0].id;
}

async function addListing(hostId, l) {
  const exists = await pool.query('SELECT 1 FROM listings WHERE title = $1 AND host_id = $2', [l.title, hostId]);
  if (exists.rowCount) return;
  await pool.query(
    `INSERT INTO listings (host_id, title, description, address, location, price_hour, price_day, amenities, status)
     VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7, $8, $9, $10)`,
    [hostId, l.title, l.description, l.address, l.lng, l.lat, l.hour, l.day, l.amenities, l.status],
  );
}

async function run() {
  await upsertUser(env.ADMIN_PHONE, 'Admin', ['admin']);
  const host = await upsertUser('+919000000001', 'Demo Host', ['host', 'seeker']);
  await upsertUser('+919000000002', 'Demo Seeker', ['seeker']);

  await addListing(host, { title: 'Covered spot near Connaught Place', description: 'Safe covered parking, 2 min walk to metro.',
    address: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167, hour: 40, day: 300, amenities: ['CCTV', 'Covered'], status: 'approved' });
  await addListing(host, { title: 'Driveway in Saket', description: 'Open driveway, fits one SUV.',
    address: 'Saket, New Delhi', lat: 28.5245, lng: 77.2066, hour: 30, day: 220, amenities: ['Gated'], status: 'pending' });
  await addListing(host, { title: 'EV charging bay Gurugram', description: 'Bay with 7kW charger.',
    address: 'Cyber Hub, Gurugram', lat: 28.4950, lng: 77.0890, hour: 60, day: 450, amenities: ['EV charging', 'CCTV'], status: 'pending' });

  logger.info(`seed complete. Admin phone: ${env.ADMIN_PHONE}`);
}

run().then(() => pool.end()).catch((err) => { console.error('Seed failed:', err); process.exit(1); });
