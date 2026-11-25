import { expect, test } from 'vitest';
import { captureDescriptionInput, hashDescriptionInput } from '../src/modules/descriptions/input.ts';
import { describeRoute, ruleGeneratorVersion } from '../src/modules/descriptions/rules.ts';

test('describes complete measurements in Polish with deterministic formatting', () => {
  const input = captureDescriptionInput({
    distanceM: 10075.4, elapsedDurationS: 2132, averageSpeedMps: 17 / 3.6,
    elevationGainM: 50.3, elevationLossM: 10.2, qualityFlags: [],
  });

  expect(ruleGeneratorVersion).toBe('rules-pl-1');
  expect(describeRoute(input)).toBe(
    'Trasa ma 10,08 km. Przejazd trwał 35 min 32 s. Średnia prędkość wyniosła 17 km/h. ' +
    'Suma podjazdów wyniosła 50,3 m. Suma zjazdów wyniosła 10,2 m.',
  );
  expect(describeRoute({ ...input })).toBe(describeRoute(input));
});

test('omits missing measurements and retains measured zeros', () => {
  const input = captureDescriptionInput({
    distanceM: 0, elapsedDurationS: null, averageSpeedMps: null,
    elevationGainM: null, elevationLossM: 0, qualityFlags: ['TIME_UNAVAILABLE'],
  });

  expect(describeRoute(input)).toBe('Trasa ma 0 m. Suma zjazdów wyniosła 0 m.');
});

test('hashes versioned facts independently of quality flag order', () => {
  const facts = {
    distanceM: 800, elapsedDurationS: null, averageSpeedMps: null,
    elevationGainM: null, elevationLossM: null, qualityFlags: ['TIME_UNAVAILABLE', 'ELEVATION_UNAVAILABLE'],
  };
  const input = captureDescriptionInput(facts);
  expect(input.qualityFlags).toEqual(['ELEVATION_UNAVAILABLE', 'TIME_UNAVAILABLE']);
  expect(hashDescriptionInput(input)).toMatch(/^[a-f0-9]{64}$/);
  expect(hashDescriptionInput({ ...input, qualityFlags: facts.qualityFlags })).toBe(hashDescriptionInput(input));
  expect(hashDescriptionInput({ ...input, elevationGainM: 0 })).not.toBe(hashDescriptionInput(input));
});
