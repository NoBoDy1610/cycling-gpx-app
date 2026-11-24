export const gpxVersion = '1.1';
export const gpxLimits = {
  fileBytes: 10 * 1024 * 1024,
  points: 100_000,
  tracks: 100,
  segments: 2000,
  xmlDepth: 64,
};

const errorStatuses = {
  INVALID_MULTIPART: 400,
  GPX_LIMIT_EXCEEDED: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INVALID_XML: 422,
  UNSUPPORTED_XML_DECLARATION: 422,
  UNSUPPORTED_GPX_VERSION: 422,
  INVALID_GPX_STRUCTURE: 422,
  INVALID_COORDINATES: 422,
  NO_VALID_TRACK: 422,
};

export class GpxImportError extends Error {
  readonly code: keyof typeof errorStatuses;

  constructor(code: keyof typeof errorStatuses) {
    super(code);
    this.code = code;
  }

  get status() {
    return errorStatuses[this.code];
  }
}

export type GpxPoint = {
  latitude: number;
  longitude: number;
  elevationM?: number;
  recordedAt?: string;
};

export type GpxTrack = {
  trackIndex: number;
  title: string;
  segments: GpxPoint[][];
};

export type QualityFlag = 'ELEVATION_UNAVAILABLE' | 'TIME_UNAVAILABLE' | 'TIME_INCONSISTENT';

export type ImportWarning =
  | { code: 'IGNORED_SEGMENT'; trackIndex: number; segmentIndex: number }
  | { code: QualityFlag; trackIndex: number };
