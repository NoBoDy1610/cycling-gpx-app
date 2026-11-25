import { expect, test } from 'vitest';
import { validateAiDescription } from '../src/modules/descriptions/ai.ts';
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

const aiInput = captureDescriptionInput({
  distanceM: 10070, elapsedDurationS: 2132, averageSpeedMps: 17 / 3.6,
  elevationGainM: null, elevationLossM: null, qualityFlags: ['ELEVATION_UNAVAILABLE'],
});

test('validates formatted numeric facts in AI prose', () => {
  const description = 'Na trasie pokonano 10,07 km w 35 min 32 s. Średnia prędkość wyniosła 17 km/h.';
  expect(validateAiDescription({ description }, aiInput)).toBe(description);
});

test('accepts equivalent Polish unit wording without changing the displayed description', () => {
  const description = 'Na trasie pokonano 10.07 kilometrów w 35 minut i 32 sekundy, ze średnią prędkością 17 kilometrów na godzinę.';
  expect(validateAiDescription({ description }, aiInput)).toBe(description);
});

test.each([
  'Na trasie pokonano 10,08 km w 35 min 32 s. Średnia prędkość wyniosła 17 km/h.',
  'Na trasie pokonano 10,07 km w 35 min 32 s. Średnia prędkość wyniosła 17 m/s.',
  'Na trasie pokonano 10,07 km w 35 min 32 s. Średnia prędkość wyniosła 17 km/h. Przewyższenie to 50 m.',
  'Na trasie pokonano 10,07 km w 35 min 32 s.',
  'Na trasie pokonano 10,07 km w 35 min 32 s. Średnia prędkość wyniosła -17 km/h.',
  'Na trasie pokonano 10,07 km w 35 minut i 33 sekundy. Średnia prędkość wyniosła 17 km/h.',
])('rejects missing, incorrect or unsupported AI measurements', (description) => {
  expect(validateAiDescription({ description }, aiInput)).toBeNull();
});

test('rejects unstructured AI output', () => {
  expect(validateAiDescription('Trasa ma 10,07 km.', aiInput)).toBeNull();
  expect(validateAiDescription({ description: 10.07 }, aiInput)).toBeNull();
});
