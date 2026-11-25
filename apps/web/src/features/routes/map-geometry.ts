import type { MapPoint } from './routes-api';

export function unwrapSegments(segments: MapPoint[][]): MapPoint[][] {
  const anchor = segments[0][0][1];
  return segments.map((segment) => {
    let previous = anchor;
    return segment.map(([latitude, longitude]) => {
      const unwrapped = longitude + 360 * Math.round((previous - longitude) / 360);
      previous = unwrapped;
      return [latitude, unwrapped];
    });
  });
}
