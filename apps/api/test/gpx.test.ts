import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { gpxLimits } from '../src/modules/gpx/model.ts';
import { parseGpx } from '../src/modules/gpx/parser.ts';
import { analyzeTrack } from '../src/modules/gpx/statistics.ts';

const fixture = readFileSync(new URL('./fixtures/multiple-tracks.gpx', import.meta.url));
const points = '<trkpt lat="0" lon="0"/><trkpt lat="0" lon="1"/>';

function parse(body: string, version = '1.1') {
  return parseGpx(Buffer.from(`<gpx xmlns="http://www.topografix.com/GPX/1/1" version="${version}" creator="test">${body}</gpx>`));
}

function segment(body: string) {
  return `<trkseg>${body}</trkseg>`;
}

test('preserves tracks and segment boundaries, normalizes timestamps and ignores extensions', () => {
  const { tracks, warnings } = parseGpx(fixture);

  expect(tracks.map(({ trackIndex, title }) => ({ trackIndex, title }))).toEqual([
    { trackIndex: 0, title: 'Pętla testowa & odcinki' },
    { trackIndex: 1, title: 'Ślad 2' },
  ]);
  expect(tracks[0].segments).toHaveLength(2);
  expect(tracks[0].segments[0][0]).toEqual({
    latitude: 0, longitude: 0, elevationM: 100, recordedAt: '2026-01-01T11:00:00.000Z',
  });
  expect(tracks[0].segments[1][0].longitude).toBe(50);
  expect(warnings).toEqual([{ code: 'IGNORED_SEGMENT', trackIndex: 0, segmentIndex: 1 }]);
});

test('calculates known distance, elevation, elapsed time and average speed across segments', () => {
  const { pointCount, analysis } = analyzeTrack(parseGpx(fixture).tracks[0].segments);
  expect(pointCount).toBe(4);
  expect(analysis).toMatchObject({
    algorithmVersion: 'gpx-1', elevationGainM: 50, elevationLossM: 10, elapsedDurationS: 120, qualityFlags: [],
  });
  expect(analysis.distanceM).toBeCloseTo(2223.89853, 5);
  expect(analysis.averageSpeedMps).toBeCloseTo(18.53249, 5);
});

test('keeps distance and returns null for unavailable measurements', () => {
  const { tracks } = parseGpx(fixture);
  expect(tracks[1].segments[0]).toEqual([{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.01 }]);

  const { analysis } = analyzeTrack(tracks[1].segments);
  expect(analysis.distanceM).toBeCloseTo(1111.94927, 5);
  expect(analysis).toMatchObject({
    elevationGainM: null, elevationLossM: null, elapsedDurationS: null, averageSpeedMps: null,
    qualityFlags: ['ELEVATION_UNAVAILABLE', 'TIME_UNAVAILABLE'],
  });
});

test.each([
  ['equal timestamps inside a segment', [['11:00:00', '11:00:00']]],
  ['reversed timestamps inside a segment', [['11:00:30', '11:00:00']]],
  ['overlapping times across segments', [['11:00:00', '11:01:00'], ['11:00:30', '11:02:00']]],
])('rejects %s for time and speed calculations', (_name, times: string[][]) => {
  const segments = times.map((timesInSegment) => timesInSegment.map((time, longitude) => ({
    latitude: 0, longitude, elevationM: 0, recordedAt: `2026-01-01T${time}.000Z`,
  })));
  const { analysis } = analyzeTrack(segments);
  expect(analysis).toMatchObject({
    elevationGainM: 0, elevationLossM: 0, elapsedDurationS: null, averageSpeedMps: null,
    qualityFlags: ['TIME_INCONSISTENT'],
  });
});

test('accepts an equal segment boundary and rejects invalid time zones as missing measurements', () => {
  const trackPoint = (time: string) => `<trkpt lat="0" lon="0"><time>${time}</time></trkpt>`;
  const first = segment(trackPoint('2026-02-28T23:59:00Z') + trackPoint('2026-02-28T24:00:00Z'));
  const second = segment(trackPoint('2026-03-01T00:00:00Z') + trackPoint('2026-03-01T00:01:00Z'));
  const { tracks } = parse(`<trk>${first}${second}</trk>`);
  expect(analyzeTrack(tracks[0].segments).analysis.elapsedDurationS).toBe(120);

  const invalid = parse(`<trk>${segment(trackPoint('2026-03-01T12:00:00+14:01') + trackPoint('2026-03-01T13:00:00'))}</trk>`);
  expect(analyzeTrack(invalid.tracks[0].segments).analysis.qualityFlags).toContain('TIME_UNAVAILABLE');
});

test.each(['180', '-180.00001', '0x1', '1e2', '', 'Infinity'])('rejects invalid longitude %s', (longitude) => {
  expect(() => parse(`<trk>${segment(`${points}<trkpt lat="0" lon="${longitude}"/>`)}</trk>`))
    .toThrow(expect.objectContaining({ code: 'INVALID_COORDINATES' }));
});

test('requires supported tracks and a non-empty track in every file entry', () => {
  const track = `<trk>${segment(points)}</trk>`;
  expect(() => parse(track, '1.0')).toThrow(expect.objectContaining({ code: 'UNSUPPORTED_GPX_VERSION' }));
  expect(() => parse('<rte><rtept lat="0" lon="1"/></rte>')).toThrow(expect.objectContaining({ code: 'NO_VALID_TRACK' }));
  expect(() => parse(`${track}${segment(points)}`)).toThrow(expect.objectContaining({ code: 'INVALID_GPX_STRUCTURE' }));
  expect(() => parse(`${track}<trk>${segment('<trkpt lat="0" lon="1"/>')}</trk>`))
    .toThrow(expect.objectContaining({ code: 'NO_VALID_TRACK' }));
});

test('rejects malformed XML, DTD declarations and unsupported XML declarations', () => {
  expect(() => parse('<trk><trkseg></trk>')).toThrow(expect.objectContaining({ code: 'INVALID_XML' }));
  expect(() => parseGpx(Buffer.concat([Buffer.from('<!DOCTYPE gpx>'), fixture.subarray(fixture.indexOf('<gpx'))])))
    .toThrow(expect.objectContaining({ code: 'UNSUPPORTED_XML_DECLARATION' }));
  expect(() => parseGpx(Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><gpx/>')))
    .toThrow(expect.objectContaining({ code: 'UNSUPPORTED_XML_DECLARATION' }));
  expect(() => parseGpx(new Uint8Array([0xff]))).toThrow(expect.objectContaining({ code: 'INVALID_XML' }));
});

test('enforces the complexity limits on points, depth, tracks and segments', () => {
  const track = `<trk>${segment(points)}</trk>`;
  expect(() => parse(`<trk>${segment('<trkpt lat="0" lon="0"/>'.repeat(gpxLimits.points + 1))}</trk>`))
    .toThrow(expect.objectContaining({ code: 'GPX_LIMIT_EXCEEDED' }));
  expect(() => parse('<extensions>'.repeat(gpxLimits.xmlDepth) + '</extensions>'.repeat(gpxLimits.xmlDepth) + track))
    .toThrow(expect.objectContaining({ code: 'GPX_LIMIT_EXCEEDED' }));
  expect(() => parse(track.repeat(gpxLimits.tracks + 1))).toThrow(expect.objectContaining({ code: 'GPX_LIMIT_EXCEEDED' }));
  expect(() => parse(`<trk>${'<trkseg/>'.repeat(gpxLimits.segments + 1)}${segment(points)}</trk>`))
    .toThrow(expect.objectContaining({ code: 'GPX_LIMIT_EXCEEDED' }));
});
