const API_NAME: Record<string, string> = {
  TR: 'Turkey',
  US: 'United States',
  GB: 'United Kingdom',
  KR: 'South Korea',
  KP: 'North Korea',
  CZ: 'Czech Republic',
  CI: 'Ivory Coast',
  CD: 'Democratic Republic of the Congo',
  CG: 'Congo',
  MK: 'North Macedonia',
  PS: 'Palestine',
  SZ: 'Eswatini',
  VA: 'Vatican City',
};

export async function loadCities(code: string, englishName: string): Promise<string[]> {
  const country = API_NAME[code] ?? englishName;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ country }),
      signal: controller.signal,
    });
    const body = (await response.json()) as { error?: boolean; data?: unknown };
    if (!response.ok || body.error || !Array.isArray(body.data)) return [];
    return body.data
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .sort((a, b) => a.localeCompare(b, 'tr'));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
