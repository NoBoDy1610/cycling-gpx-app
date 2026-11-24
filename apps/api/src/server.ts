import { Pool } from 'pg';
import { createApp } from './app.ts';

function readPort(name: string, fallback: number) {
  const port = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return port;
}

function requireEnvironmentVariable(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

const host = '127.0.0.1';
const port = readPort('API_PORT', 3000);
const database = new Pool({
  host,
  port: readPort('POSTGRES_PORT', 5432),
  database: requireEnvironmentVariable('POSTGRES_DB'),
  user: requireEnvironmentVariable('POSTGRES_USER'),
  password: requireEnvironmentVariable('POSTGRES_PASSWORD'),
  connectionTimeoutMillis: 2000,
  query_timeout: 2000,
});

database.on('error', () => {
  console.error('An idle PostgreSQL connection failed.');
});

const app = createApp(async () => {
  await database.query('SELECT 1');
});

app.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});
