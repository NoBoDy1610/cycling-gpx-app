import { SaxesParser } from 'saxes';
import type { SaxesTagNS } from 'saxes';
import { GpxImportError, gpxLimits, gpxVersion } from './model.ts';
import type { GpxPoint, GpxTrack, ImportWarning } from './model.ts';

const gpxNamespace = 'http://www.topografix.com/GPX/1/1';
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const dateTime = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;
const maxScalarLength = 512;
const trackElements = new Set(['gpx', 'trk', 'trkseg', 'trkpt']);

type TrackFrame = { kind: 'track'; track: GpxTrack; nextSegment: number; named: boolean };
type SegmentFrame = { kind: 'segment'; track: GpxTrack; segmentIndex: number; points: GpxPoint[] };
type PointFrame = { kind: 'point'; parent: SegmentFrame; point: GpxPoint; elevationSeen: boolean; timeSeen: boolean };
type ScalarFrame = ({ kind: 'name'; track: GpxTrack } | { kind: 'elevation' | 'time'; point: GpxPoint }) & {
  text: string;
  invalid: boolean;
};
type Frame = { kind: 'root' } | { kind: 'ignored' } | TrackFrame | SegmentFrame | PointFrame | ScalarFrame;

const ignored: Frame = { kind: 'ignored' };

function readDecimal(value: string | undefined) {
  const text = value?.trim();
  if (!text || !decimal.test(text)) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

function readTimestamp(value: string) {
  const text = value.trim();
  const parts = dateTime.exec(text);
  if (!parts) return undefined;
  const [, date, hours, minutes, seconds, fraction, , offsetHours, offsetMinutes] = parts;
  const day = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(day) || date.startsWith('0000-') || new Date(day).toISOString().slice(0, 10) !== date) {
    return undefined;
  }
  if (offsetHours && (Number(offsetHours) > 14 || Number(offsetMinutes) > 59 || (offsetHours === '14' && offsetMinutes !== '00'))) {
    return undefined;
  }
  if (hours === '24' && (minutes !== '00' || seconds !== '00' || /[1-9]/.test(fraction ?? ''))) {
    return undefined;
  }
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function readPoint(tag: SaxesTagNS): GpxPoint {
  const latitude = readDecimal(tag.attributes.lat?.value);
  const longitude = readDecimal(tag.attributes.lon?.value);
  if (latitude === undefined || latitude < -90 || latitude > 90 || longitude === undefined || longitude < -180 || longitude >= 180) {
    throw new GpxImportError('INVALID_COORDINATES');
  }
  return { latitude, longitude };
}

function isScalar(frame: Frame | undefined): frame is ScalarFrame {
  return frame?.kind === 'name' || frame?.kind === 'elevation' || frame?.kind === 'time';
}

export function parseGpx(bytes: Uint8Array) {
  if (bytes.byteLength > gpxLimits.fileBytes) throw new GpxImportError('GPX_LIMIT_EXCEEDED');

  let xml: string;
  try {
    xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new GpxImportError('INVALID_XML');
  }

  const parser = new SaxesParser({ xmlns: true });
  const stack: Frame[] = [];
  const tracks: GpxTrack[] = [];
  const warnings: ImportWarning[] = [];
  let segments = 0;
  let points = 0;

  function openElement(tag: SaxesTagNS): Frame {
    const parent = stack.at(-1);
    if (!parent) {
      if (tag.local !== 'gpx') throw new GpxImportError('INVALID_GPX_STRUCTURE');
      if (tag.uri !== gpxNamespace || tag.attributes.version?.value !== gpxVersion) {
        throw new GpxImportError('UNSUPPORTED_GPX_VERSION');
      }
      if (!tag.attributes.creator) throw new GpxImportError('INVALID_GPX_STRUCTURE');
      return { kind: 'root' };
    }
    if (isScalar(parent)) {
      parent.invalid = true;
      return ignored;
    }
    if (tag.uri !== gpxNamespace) return ignored;

    if (parent.kind === 'root' && tag.local === 'trk') {
      if (tracks.length >= gpxLimits.tracks) throw new GpxImportError('GPX_LIMIT_EXCEEDED');
      const track = { trackIndex: tracks.length, title: `Ślad ${tracks.length + 1}`, segments: [] };
      return { kind: 'track', track, nextSegment: 0, named: false };
    }
    if (parent.kind === 'track' && tag.local === 'name') {
      if (parent.named) throw new GpxImportError('INVALID_GPX_STRUCTURE');
      parent.named = true;
      return { kind: 'name', track: parent.track, text: '', invalid: false };
    }
    if (parent.kind === 'track' && tag.local === 'trkseg') {
      if (++segments > gpxLimits.segments) throw new GpxImportError('GPX_LIMIT_EXCEEDED');
      return { kind: 'segment', track: parent.track, segmentIndex: parent.nextSegment++, points: [] };
    }
    if (parent.kind === 'segment' && tag.local === 'trkpt') {
      if (++points > gpxLimits.points) throw new GpxImportError('GPX_LIMIT_EXCEEDED');
      return { kind: 'point', parent, point: readPoint(tag), elevationSeen: false, timeSeen: false };
    }
    if (parent.kind === 'point' && tag.local === 'ele') {
      if (parent.elevationSeen) throw new GpxImportError('INVALID_GPX_STRUCTURE');
      parent.elevationSeen = true;
      return { kind: 'elevation', point: parent.point, text: '', invalid: false };
    }
    if (parent.kind === 'point' && tag.local === 'time') {
      if (parent.timeSeen) throw new GpxImportError('INVALID_GPX_STRUCTURE');
      parent.timeSeen = true;
      return { kind: 'time', point: parent.point, text: '', invalid: false };
    }
    if (parent.kind !== 'ignored' && trackElements.has(tag.local)) {
      throw new GpxImportError('INVALID_GPX_STRUCTURE');
    }
    return ignored;
  }

  function collectText(text: string) {
    const frame = stack.at(-1);
    if (!isScalar(frame) || frame.invalid) return;
    if (frame.text.length + text.length > maxScalarLength) {
      frame.invalid = true;
      return;
    }
    frame.text += text;
  }

  parser.on('error', () => { throw new GpxImportError('INVALID_XML'); });
  parser.on('doctype', () => { throw new GpxImportError('UNSUPPORTED_XML_DECLARATION'); });
  parser.on('xmldecl', ({ version, encoding }) => {
    if (version !== '1.0' || (encoding && encoding.toLowerCase() !== 'utf-8')) {
      throw new GpxImportError('UNSUPPORTED_XML_DECLARATION');
    }
  });
  parser.on('opentag', (tag) => {
    if (stack.length >= gpxLimits.xmlDepth) throw new GpxImportError('GPX_LIMIT_EXCEEDED');
    stack.push(openElement(tag));
  });
  parser.on('text', collectText);
  parser.on('cdata', collectText);
  parser.on('closetag', () => {
    const frame = stack.pop();
    if (frame?.kind === 'point') {
      frame.parent.points.push(frame.point);
    } else if (frame?.kind === 'segment') {
      if (frame.points.length >= 2) {
        frame.track.segments.push(frame.points);
      } else {
        warnings.push({ code: 'IGNORED_SEGMENT', trackIndex: frame.track.trackIndex, segmentIndex: frame.segmentIndex });
      }
    } else if (frame?.kind === 'track') {
      if (!frame.track.segments.length) throw new GpxImportError('NO_VALID_TRACK');
      tracks.push(frame.track);
    } else if (isScalar(frame) && !frame.invalid) {
      if (frame.kind === 'name') {
        const title = Array.from(frame.text.trim()).slice(0, 200).join('');
        if (title) frame.track.title = title;
      } else if (frame.kind === 'elevation') {
        const elevationM = readDecimal(frame.text);
        if (elevationM !== undefined) frame.point.elevationM = elevationM;
      } else {
        const recordedAt = readTimestamp(frame.text);
        if (recordedAt !== undefined) frame.point.recordedAt = recordedAt;
      }
    }
  });

  parser.write(xml).close();
  if (!tracks.length) throw new GpxImportError('NO_VALID_TRACK');
  return { tracks, warnings };
}
