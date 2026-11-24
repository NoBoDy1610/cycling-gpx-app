import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client.ts';
import { databaseSettings } from './environment.ts';

export function createDatabase(test = false) {
  const pool = new Pool({
    ...databaseSettings(test),
    connectionTimeoutMillis: 2000,
    query_timeout: 2000,
  });
  pool.on('error', () => {
    console.error('An idle PostgreSQL connection failed.');
  });

  const client = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { pool, client };
}
