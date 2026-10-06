export interface KnownCity {
  name: string;
  latitude: number;
  longitude: number;
}

/** Harici geocoding servisi kullanılmaz; manuel girişte ve Passport'ta bilinen şehir merkezleri. */
export const KNOWN_CITIES: ReadonlyArray<KnownCity> = [
  { name: 'İstanbul', latitude: 41.01, longitude: 28.98 },
  { name: 'Ankara', latitude: 39.93, longitude: 32.86 },
  { name: 'İzmir', latitude: 38.42, longitude: 27.14 },
  { name: 'Bursa', latitude: 40.19, longitude: 29.06 },
  { name: 'Antalya', latitude: 36.9, longitude: 30.7 },
  { name: 'Adana', latitude: 37.0, longitude: 35.32 },
  { name: 'Konya', latitude: 37.87, longitude: 32.48 },
  { name: 'Gaziantep', latitude: 37.07, longitude: 37.38 },
  { name: 'Kayseri', latitude: 38.73, longitude: 35.49 },
  { name: 'Eskişehir', latitude: 39.78, longitude: 30.52 },
  { name: 'Mersin', latitude: 36.81, longitude: 34.64 },
  { name: 'Diyarbakır', latitude: 37.91, longitude: 40.24 },
  { name: 'Samsun', latitude: 41.29, longitude: 36.33 },
  { name: 'Trabzon', latitude: 41.0, longitude: 39.72 },
  { name: 'Denizli', latitude: 37.78, longitude: 29.09 },
];

export function normalizeCity(city: string): string {
  return city
    .trim()
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ı/g, 'i');
}

const CITY_INDEX = new Map(KNOWN_CITIES.map((city) => [normalizeCity(city.name), city]));

export function findKnownCity(name: string): KnownCity | undefined {
  return CITY_INDEX.get(normalizeCity(name));
}
