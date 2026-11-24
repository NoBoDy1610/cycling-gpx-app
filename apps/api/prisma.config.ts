import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';
import { databaseSettings } from './src/infrastructure/environment.ts';

try {
  loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
    throw error;
  }
}

const test = process.env.RUN_DATABASE_TESTS === '1';
let datasource: { url: string } | undefined;
if (test || process.env.POSTGRES_DB) {
  const settings = databaseSettings(test);
  const url = new URL(`postgresql://${settings.host}:${settings.port}`);
  url.username = encodeURIComponent(settings.user);
  url.password = encodeURIComponent(settings.password);
  url.pathname = `/${encodeURIComponent(settings.database)}`;
  datasource = { url: url.toString() };
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource,
});
