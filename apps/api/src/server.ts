import { createApp } from './app.ts';
import { createDatabase } from './infrastructure/database.ts';
import { allowedOrigins, readPort } from './infrastructure/environment.ts';

const host = '127.0.0.1';
const port = readPort('API_PORT', 3000);
const { pool, client } = createDatabase();

const app = createApp(async () => {
  await pool.query('SELECT 1');
}, {
  database: client,
  origins: allowedOrigins(),
  secureCookies: process.env.NODE_ENV === 'production',
});

app.listen(port, host).on('listening', () => {
  console.log(`API listening on http://${host}:${port}`);
});
