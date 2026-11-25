import { expect, test } from 'vitest';
import { unwrapSegments } from './map-geometry';

test('unwraps antimeridian crossings while preserving separate segments', () => {
  expect(unwrapSegments([[[12, 179], [12, -179]], [[13, -178], [13, 178]]])).toEqual([
    [[12, 179], [12, 181]], [[13, 182], [13, 178]],
  ]);
});
