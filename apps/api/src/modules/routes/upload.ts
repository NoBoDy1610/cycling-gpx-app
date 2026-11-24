import { Transform } from 'node:stream';
import busboy from 'busboy';
import type { Request } from 'express';
import { GpxImportError, gpxLimits } from '../gpx/model.ts';

const maxRequestBytes = gpxLimits.fileBytes + 64 * 1024;

export function receiveGpxUpload(request: Request): Promise<Buffer> {
  if (!request.is('multipart/form-data')) throw new GpxImportError('UNSUPPORTED_MEDIA_TYPE');
  if (Number(request.get('content-length')) > maxRequestBytes) throw new GpxImportError('GPX_LIMIT_EXCEEDED');

  let reader: ReturnType<typeof busboy>;
  try {
    reader = busboy({
      headers: request.headers,
      limits: { fileSize: gpxLimits.fileBytes + 1, files: 1, fields: 0, parts: 2 },
    });
  } catch {
    throw new GpxImportError('INVALID_MULTIPART');
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let fileBytes = 0;
    let settled = false;

    const meter = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        totalBytes += chunk.length;
        if (totalBytes > maxRequestBytes) {
          done(new GpxImportError('GPX_LIMIT_EXCEEDED'));
        } else {
          done(null, chunk);
        }
      },
    });

    function fail(error: GpxImportError) {
      if (settled) return;
      settled = true;
      // Busboy finishes its current write after emitting a limit event.
      queueMicrotask(() => {
        request.unpipe(meter);
        meter.unpipe(reader);
        meter.destroy();
        reader.destroy();
        request.resume();
        reject(error);
      });
    }

    function invalidMultipart() {
      fail(new GpxImportError('INVALID_MULTIPART'));
    }

    meter.on('error', (error: unknown) => {
      fail(error instanceof GpxImportError ? error : new GpxImportError('INVALID_MULTIPART'));
    });
    request.on('error', invalidMultipart);
    request.on('close', () => {
      if (!request.complete) invalidMultipart();
    });
    reader.on('error', invalidMultipart);
    reader.on('filesLimit', invalidMultipart);
    reader.on('fieldsLimit', invalidMultipart);
    reader.on('partsLimit', invalidMultipart);

    reader.on('file', (name, file) => {
      file.on('error', invalidMultipart);
      if (name !== 'file') {
        invalidMultipart();
        return;
      }
      file.on('limit', () => fail(new GpxImportError('GPX_LIMIT_EXCEEDED')));
      file.on('data', (chunk: Buffer) => {
        fileBytes += chunk.length;
        chunks.push(chunk);
      });
    });

    reader.on('close', () => {
      if (settled) return;
      if (!fileBytes) {
        invalidMultipart();
        return;
      }
      settled = true;
      resolve(Buffer.concat(chunks, fileBytes));
    });

    request.pipe(meter).pipe(reader);
  });
}
