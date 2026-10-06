'use client';

import type { MyProfileDto } from '@dating/types';
import { Alert, Button, Field, Input } from '@dating/ui';
import { KNOWN_CITIES, findKnownCity } from '@dating/validation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api-client';
import { queryKeys } from '@/lib/queries';

type Coordinates = { latitude: number; longitude: number };

const GEO_ERRORS: Record<number, string> = {
  1: 'Konum izni verilmedi. Tarayıcı ayarlarından izin verebilir veya şehrini elle girebilirsin.',
  2: 'Konumun belirlenemedi. Lütfen tekrar dene.',
  3: 'Konum isteği zaman aşımına uğradı.',
};

function currentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Tarayıcın konum özelliğini desteklemiyor.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new Error(GEO_ERRORS[error.code] ?? 'Konum alınamadı.')),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
    );
  });
}

export function LocationForm({
  me,
  submitLabel,
  onSaved,
}: {
  me: MyProfileDto;
  submitLabel: string;
  onSaved: (profile: MyProfileDto) => void;
}) {
  const queryClient = useQueryClient();
  const [city, setCity] = useState(me.profile?.city ?? '');
  const [pending, setPending] = useState<'geo' | 'manual' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (coordinates: Coordinates, mode: 'geo' | 'manual') => {
    setPending(mode);
    setError(null);
    try {
      const result = await api<MyProfileDto>('/profile/me/location', {
        method: 'PUT',
        body: { ...coordinates, city: city.trim() || null, country: me.profile?.country ?? 'TR' },
      });
      queryClient.setQueryData(queryKeys.myProfile, result);
      onSaved(result);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setPending(null);
    }
  };

  const useDeviceLocation = async () => {
    setPending('geo');
    setError(null);
    try {
      await save(await currentPosition(), 'geo');
    } catch (geoError) {
      setPending(null);
      setError(geoError instanceof Error ? geoError.message : 'Konum alınamadı.');
    }
  };

  const useManualCity = () => {
    const known = findKnownCity(city);
    if (!known) {
      setError('Bu şehri tanıyamadık. Lütfen konum iznini kullan veya listeden bir şehir yaz.');
      return;
    }
    void save({ latitude: known.latitude, longitude: known.longitude }, 'manual');
  };

  return (
    <div className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}
      {me.profile?.hasLocation && (
        <Alert tone="success">
          Konumun kayıtlı{me.profile.city ? ` (${me.profile.city})` : ''}. İstersen güncelleyebilirsin.
        </Alert>
      )}

      <div className="space-y-2">
        <Button size="lg" fullWidth loading={pending === 'geo'} disabled={pending !== null} onClick={useDeviceLocation}>
          Konumumu kullan
        </Button>
        <p className="text-text-muted text-center text-xs">
          Konumun yaklaşık olarak (~1 km) saklanır; diğer kullanıcılar yalnızca şehrini ve uzaklığı görür.
        </p>
      </div>

      <div className="text-text-muted flex items-center gap-3 text-xs">
        <span className="bg-text/10 h-px flex-1" />
        veya şehrini yaz
        <span className="bg-text/10 h-px flex-1" />
      </div>

      <div className="space-y-3">
        <Field label="Şehir" hint="Konum izni vermeden yalnızca şehir merkezi kullanılır.">
          <Input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            autoComplete="address-level2"
            list="known-cities"
          />
        </Field>
        <datalist id="known-cities">
          {KNOWN_CITIES.map(({ name }) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <Button
          variant="secondary"
          fullWidth
          loading={pending === 'manual'}
          disabled={pending !== null || !city.trim()}
          onClick={useManualCity}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
