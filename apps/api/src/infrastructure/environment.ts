export function readPort(name: string, fallback: number) {
  const port = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return port;
}

function requireVariable(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function databaseSettings(test = false) {
  return {
    host: '127.0.0.1',
    port: test ? readPort('POSTGRES_TEST_PORT', 5433) : readPort('POSTGRES_PORT', 5432),
    database: test ? 'cycling_gpx_test' : requireVariable('POSTGRES_DB'),
    user: test ? 'cycling_gpx_test' : requireVariable('POSTGRES_USER'),
    password: test ? 'cycling_gpx_test' : requireVariable('POSTGRES_PASSWORD'),
  };
}

export function allowedOrigins() {
  const origin = process.env.APP_ORIGIN;
  if (!origin && process.env.NODE_ENV !== 'production') {
    return ['http://127.0.0.1:5173', 'http://127.0.0.1:4173'];
  }

  const url = new URL(requireVariable('APP_ORIGIN'));
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('APP_ORIGIN must be an HTTP or HTTPS origin without a trailing slash.');
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('APP_ORIGIN must use HTTPS in production.');
  }
  return [url.origin];
}
