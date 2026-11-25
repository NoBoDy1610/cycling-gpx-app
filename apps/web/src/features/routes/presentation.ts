import { RouteRequestError } from './routes-api';

const dateFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });
const integerFormatter = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
const routePlural = new Intl.PluralRules('pl-PL');

export const missingMeasurement = 'Brak danych';

export const warningMessages: Record<string, string> = {
  IGNORED_SEGMENT: 'Pominięto puste segmenty lub segmenty z jednym punktem.',
  ELEVATION_UNAVAILABLE: 'Niepełne dane wysokościowe uniemożliwiły obliczenie podjazdów i zjazdów.',
  TIME_UNAVAILABLE: 'Brakuje poprawnych znaczników czasu do obliczenia czasu i średniej prędkości.',
  TIME_INCONSISTENT: 'Niespójne znaczniki czasu uniemożliwiły obliczenie czasu i średniej prędkości.',
};

export function warningText(code: string) {
  return Object.hasOwn(warningMessages, code) ? warningMessages[code] : 'Zapis GPX zawiera ostrzeżenie dotyczące jakości danych.';
}

export function routeErrorText(error: unknown, onSessionExpired: () => void) {
  if (error instanceof RouteRequestError && error.code === 'SESSION_REQUIRED') {
    onSessionExpired();
    return '';
  }
  return error instanceof RouteRequestError ? error.message : 'Nie udało się połączyć z usługą tras.';
}

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function formatInteger(value: number) {
  return integerFormatter.format(value);
}

export function formatDistance(meters: number | null) {
  if (meters === null) return missingMeasurement;
  return meters < 1000 ? `${decimalFormatter.format(meters)} m` : `${decimalFormatter.format(meters / 1000)} km`;
}

export function formatElevation(meters: number | null) {
  return meters === null ? missingMeasurement : `${decimalFormatter.format(meters)} m`;
}

export function formatSpeed(metersPerSecond: number | null) {
  return metersPerSecond === null ? missingMeasurement : `${decimalFormatter.format(metersPerSecond * 3.6)} km/h`;
}

export function formatDuration(seconds: number | null) {
  if (seconds === null) return missingMeasurement;
  if (seconds < 1) return `${decimalFormatter.format(seconds)} s`;
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainder = rounded % 60;
  if (hours) return `${hours} h ${minutes} min ${remainder} s`;
  return minutes ? `${minutes} min ${remainder} s` : `${remainder} s`;
}

export function importMessage(count: number) {
  const plural = routePlural.select(count);
  return `Dodano ${count} ${plural === 'one' ? 'trasę' : plural === 'few' ? 'trasy' : 'tras'}.`;
}

