export type MapPoint = [latitude: number, longitude: number];

export interface RouteSummary {
  id: string;
  title: string;
  importedAt: string;
  distanceM: number | null;
}

interface Analysis {
  distanceM: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  elapsedDurationS: number | null;
  averageSpeedMps: number | null;
  qualityFlags: string[];
}

export interface RouteDetails {
  id: string;
  title: string;
  importedAt: string;
  pointCount: number;
  segments: MapPoint[][];
  analysis: Analysis | null;
}

const errorMessages: Record<string, string> = {
  INVALID_MULTIPART: 'Wybierz jeden niepusty plik GPX.',
  GPX_LIMIT_EXCEEDED: 'Plik przekracza limit rozmiaru lub złożoności GPX.',
  UNSUPPORTED_MEDIA_TYPE: 'Wybierz plik GPX i spróbuj ponownie.',
  INVALID_XML: 'Plik ma niepoprawną strukturę XML.',
  UNSUPPORTED_XML_DECLARATION: 'Wybierz plik GPX zapisany jako XML 1.0 w UTF-8.',
  UNSUPPORTED_GPX_VERSION: 'Import obsługuje pliki GPX w wersji 1.1.',
  INVALID_GPX_STRUCTURE: 'Plik ma niepoprawną strukturę GPX.',
  INVALID_COORDINATES: 'Jeden z punktów śladu ma niepoprawne współrzędne.',
  NO_VALID_TRACK: 'Każdy ślad musi mieć segment z co najmniej dwoma punktami.',
  ROUTE_NOT_FOUND: 'Ta trasa jest już niedostępna.',
  ANALYSIS_NOT_FOUND: 'Analiza trasy jest niedostępna. Odśwież szczegóły trasy.',
  SESSION_REQUIRED: 'Sesja wygasła. Zaloguj się ponownie.',
};

export class RouteRequestError extends Error {
  constructor(readonly code: string) {
    super(Object.hasOwn(errorMessages, code) ? errorMessages[code] : 'Operacja na trasie nie powiodła się. Spróbuj ponownie.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`/api/routes${path}`, init);
  if (response.status === 204) return undefined;

  const payload: unknown = await response.json();
  if (!response.ok) {
    const code = isRecord(payload) && isRecord(payload.error) ? payload.error.code : undefined;
    throw new RouteRequestError(typeof code === 'string' ? code : 'UNKNOWN_ERROR');
  }
  return payload;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isDatedRoute(value: Record<string, unknown>) {
  return typeof value.id === 'string' && typeof value.title === 'string' && typeof value.importedAt === 'string' &&
    Number.isFinite(Date.parse(value.importedAt));
}

function isRouteSummary(value: unknown): value is RouteSummary {
  return isRecord(value) && isDatedRoute(value) && isOptionalNumber(value.distanceM);
}

function isAnalysis(value: unknown): value is Analysis {
  return isRecord(value) && isNumber(value.distanceM) && isOptionalNumber(value.elevationGainM) &&
    isOptionalNumber(value.elevationLossM) && isOptionalNumber(value.elapsedDurationS) &&
    isOptionalNumber(value.averageSpeedMps) && Array.isArray(value.qualityFlags) &&
    value.qualityFlags.every((flag) => typeof flag === 'string');
}

function isSegment(value: unknown): value is MapPoint[] {
  return Array.isArray(value) && value.length >= 2 && value.every((point) =>
    Array.isArray(point) && point.length === 2 && isNumber(point[0]) && isNumber(point[1]),
  );
}

function isRouteDetails(value: unknown): value is RouteDetails {
  return isRecord(value) && isDatedRoute(value) && isNumber(value.pointCount) &&
    Array.isArray(value.segments) && value.segments.length > 0 && value.segments.every(isSegment) &&
    (value.analysis === null || isAnalysis(value.analysis));
}

export async function fetchRoutes(signal: AbortSignal, cursor?: string) {
  const query = cursor ? `?${new URLSearchParams({ cursor })}` : '';
  const payload = await request(query, { signal });
  if (isRecord(payload) && Array.isArray(payload.routes) && payload.routes.every(isRouteSummary) &&
    (payload.nextCursor === null || typeof payload.nextCursor === 'string')) {
    return { routes: payload.routes, nextCursor: payload.nextCursor };
  }
  throw new RouteRequestError('UNKNOWN_ERROR');
}

export async function fetchRoute(id: string, signal: AbortSignal) {
  const payload = await request(`/${encodeURIComponent(id)}`, { signal });
  if (isRecord(payload) && isRouteDetails(payload.route)) return payload.route;
  throw new RouteRequestError('UNKNOWN_ERROR');
}

export async function importGpx(file: File) {
  const body = new FormData();
  body.append('file', file);
  const payload = await request('/import', { method: 'POST', body });
  if (isRecord(payload) && isRecord(payload.import) && Array.isArray(payload.import.routes) &&
    Array.isArray(payload.import.warnings)) {
    const first = payload.import.routes[0];
    if (isRecord(first) && typeof first.id === 'string') {
      const warnings = payload.import.warnings.flatMap((warning: unknown) =>
        isRecord(warning) && typeof warning.code === 'string' ? [warning.code] : [],
      );
      return { firstRouteId: first.id, routeCount: payload.import.routes.length, warnings: [...new Set(warnings)] };
    }
  }
  throw new RouteRequestError('UNKNOWN_ERROR');
}

export async function removeRoute(id: string) {
  await request(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

function readRuleText(comparison: unknown) {
  if (!isRecord(comparison) || !Array.isArray(comparison.runs)) return undefined;
  for (const run of comparison.runs as unknown[]) {
    if (isRecord(run) && run.method === 'RULE_BASED' && run.status === 'SUCCEEDED' && typeof run.outputText === 'string') {
      return run.outputText;
    }
  }
  return undefined;
}

export async function fetchRuleDescription(routeId: string, signal: AbortSignal) {
  const payload = await request(`/${encodeURIComponent(routeId)}/comparisons`, { signal });
  if (isRecord(payload) && Array.isArray(payload.comparisons)) {
    for (const comparison of payload.comparisons as unknown[]) {
      const text = readRuleText(comparison);
      if (text !== undefined) return text;
    }
    return null;
  }
  throw new RouteRequestError('UNKNOWN_ERROR');
}

export async function generateRuleDescription(routeId: string, signal: AbortSignal) {
  const payload = await request(`/${encodeURIComponent(routeId)}/comparisons`, { method: 'POST', signal });
  const text = isRecord(payload) ? readRuleText(payload.comparison) : undefined;
  if (text !== undefined) return text;
  throw new RouteRequestError('UNKNOWN_ERROR');
}
