import type { GpxPoint, QualityFlag } from './model.ts';

const earthRadiusM = 6_371_000;
const degreesToRadians = Math.PI / 180;
export const algorithmVersion = 'gpx-1';

function distanceBetween(first: GpxPoint, second: GpxPoint) {
  const firstLatitude = first.latitude * degreesToRadians;
  const secondLatitude = second.latitude * degreesToRadians;
  const latitudeDifference = secondLatitude - firstLatitude;
  const longitudeDifference = (second.longitude - first.longitude) * degreesToRadians;
  const haversine = Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDifference / 2) ** 2;

  return 2 * earthRadiusM * Math.asin(Math.sqrt(Math.max(0, Math.min(1, haversine))));
}

export function analyzeTrack(segments: readonly (readonly GpxPoint[])[]) {
  let pointCount = 0;
  let distanceM = 0;
  let elevationGainM = 0;
  let elevationLossM = 0;
  let completeElevation = true;
  let completeTime = true;
  let consistentTime = true;
  let firstTime: number | undefined;
  let lastTime: number | undefined;

  for (const segment of segments) {
    let previous: GpxPoint | undefined;
    let previousTime: number | undefined;

    for (const point of segment) {
      pointCount += 1;
      if (previous) distanceM += distanceBetween(previous, point);

      if (point.elevationM === undefined) {
        completeElevation = false;
      } else if (previous?.elevationM !== undefined) {
        const difference = point.elevationM - previous.elevationM;
        elevationGainM += Math.max(0, difference);
        elevationLossM += Math.max(0, -difference);
      }

      const time = point.recordedAt === undefined ? undefined : Date.parse(point.recordedAt);
      if (time === undefined || !Number.isFinite(time)) {
        completeTime = false;
      } else {
        if (previousTime !== undefined && time <= previousTime) consistentTime = false;
        if (!previous && lastTime !== undefined && time < lastTime) consistentTime = false;
        firstTime ??= time;
        lastTime = time;
        previousTime = time;
      }
      previous = point;
    }
  }

  const qualityFlags: QualityFlag[] = [];
  const elevationAvailable = completeElevation && Number.isFinite(elevationGainM) && Number.isFinite(elevationLossM);
  if (!elevationAvailable) qualityFlags.push('ELEVATION_UNAVAILABLE');
  if (!completeTime) qualityFlags.push('TIME_UNAVAILABLE');
  if (!consistentTime) qualityFlags.push('TIME_INCONSISTENT');

  const duration = firstTime === undefined || lastTime === undefined ? 0 : (lastTime - firstTime) / 1000;
  const elapsedDurationS = completeTime && consistentTime && duration > 0 ? duration : null;

  return {
    pointCount,
    analysis: {
      algorithmVersion,
      distanceM,
      elevationGainM: elevationAvailable ? elevationGainM : null,
      elevationLossM: elevationAvailable ? elevationLossM : null,
      elapsedDurationS,
      averageSpeedMps: elapsedDurationS === null ? null : distanceM / elapsedDurationS,
      qualityFlags,
    },
  };
}
