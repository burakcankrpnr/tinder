import { findKnownCity } from '@dating/validation';
import * as Location from 'expo-location';
import { countryByCode } from './countries';

function tidy(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/\s+(Province|İli)$/i, '').trim();
  return trimmed ? trimmed : null;
}

/** Türkiye'de sistem `city` alanına ilçeyi yazar. Profilde il (şehir) görünür. */
function settlement(place: Location.LocationGeocodedAddress): string | null {
  const country = place.isoCountryCode?.toUpperCase();
  const region = tidy(place.region);
  const city = tidy(place.city);
  const subregion = tidy(place.subregion);
  const raw = country === 'TR' ? (region ?? city ?? subregion) : (city ?? subregion ?? region);
  if (!raw) return null;
  return findKnownCity(raw)?.name ?? raw;
}

export interface DetectedPlace {
  countryCode: string;
  city: string | null;
  source: 'gps' | 'ip';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

function asPlace(code: unknown, city: unknown, source: DetectedPlace['source']): DetectedPlace | null {
  if (typeof code !== 'string' || !countryByCode(code)) return null;
  return {
    countryCode: code.toUpperCase(),
    city: typeof city === 'string' && city.trim() ? city.trim() : null,
    source,
  };
}

async function detectFromGps(): Promise<DetectedPlace | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const position = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    12000,
  );
  if (!position) return null;
  const places = await withTimeout(Location.reverseGeocodeAsync(position.coords), 8000);
  const place = places?.[0];
  if (!place) return null;
  return asPlace(place.isoCountryCode, settlement(place), 'gps');
}

async function detectFromIp(): Promise<DetectedPlace | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://ipwho.is/', { headers: { accept: 'application/json' }, signal: controller.signal });
    const body = (await response.json()) as { success?: boolean; country_code?: unknown; city?: unknown };
    if (!response.ok || body.success === false) return null;
    return asPlace(body.country_code, body.city, 'ip');
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface CapturedLocation {
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
}

export async function captureLocation(ask: boolean): Promise<CapturedLocation | null> {
  const current = await Location.getForegroundPermissionsAsync();
  if (!current.granted) {
    if (!ask) return null;
    const asked = await Location.requestForegroundPermissionsAsync();
    if (!asked.granted) return null;
  }
  const position = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    12000,
  );
  if (!position) return null;
  const places = await withTimeout(Location.reverseGeocodeAsync(position.coords), 8000);
  const place = places?.[0];
  const code = place?.isoCountryCode?.toUpperCase();
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    city: place ? settlement(place) : null,
    country: code && countryByCode(code) ? code : null,
  };
}

let lastRefresh = 0;

export async function refreshStoredLocation(): Promise<void> {
  const now = Date.now();
  if (now - lastRefresh < 30_000) return;
  lastRefresh = now;
  const place = await captureLocation(false);
  if (!place) {
    lastRefresh = 0;
    return;
  }
  try {
    const { api } = await import('./api');
    await api('/profile/me/location', {
      method: 'PUT',
      body: {
        latitude: place.latitude,
        longitude: place.longitude,
        city: place.city,
        country: place.country,
      },
    });
  } catch {
    lastRefresh = 0;
  }
}

let detectedPlace: Promise<DetectedPlace | null> | null = null;

export function detectPlace(): Promise<DetectedPlace | null> {
  detectedPlace ??= (async () => (await detectFromGps()) ?? (await detectFromIp()))();
  return detectedPlace;
}

export function findCity(cities: readonly string[], guess: string): string | null {
  const foldedGuess = fold(guess);
  if (foldedGuess.length < 2) return null;
  return (
    cities.find((item) => fold(item) === foldedGuess) ??
    cities.find((item) => foldedGuess.length >= 4 && (fold(item).startsWith(foldedGuess) || foldedGuess.startsWith(fold(item)))) ??
    null
  );
}

function fold(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i');
}
