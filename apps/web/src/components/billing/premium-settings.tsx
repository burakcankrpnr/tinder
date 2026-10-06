'use client';

import type { RelationshipIntention } from '@dating/types';
import { Alert, Chip, Field, Select, Spinner } from '@dating/ui';
import { KNOWN_CITIES, RELATIONSHIP_INTENTIONS, type PremiumSettingsInput } from '@dating/validation';
import { Switch } from '@/components/switch';
import { errorMessage } from '@/lib/api-client';
import { isPaywallError, useEntitlements, usePremiumSettings, useUpdatePremiumSettings } from '@/lib/billing';
import { INTENTION_LABELS } from '@/lib/labels';
import { usePaywall } from './paywall';

function LockHint({ locked }: { locked: boolean }) {
  if (!locked) return null;
  return <span className="text-warning ml-2 text-xs font-normal">Premium</span>;
}

/** Incognito, Passport ve gelişmiş filtreler; kilitli özellik açılmak istenirse paywall gösterilir. */
export function PremiumSettings() {
  const paywall = usePaywall();
  const entitlements = useEntitlements();
  const settings = usePremiumSettings();
  const update = useUpdatePremiumSettings();

  if (settings.isPending || entitlements.isPending) {
    return (
      <div className="text-primary flex justify-center py-6">
        <Spinner className="size-6" label="Premium ayarlar yükleniyor" />
      </div>
    );
  }
  if (settings.isError) return <Alert tone="danger">{errorMessage(settings.error)}</Alert>;

  const features = entitlements.data?.features;
  const save = (input: PremiumSettingsInput) =>
    update.mutate(input, {
      onError: (error) => {
        if (isPaywallError(error)) paywall.open(error.message);
      },
    });
  const toggleIntention = (intention: RelationshipIntention) => {
    const current = settings.data.intentions;
    save({
      intentions: current.includes(intention)
        ? current.filter((item) => item !== intention)
        : [...current, intention],
    });
  };

  return (
    <div className="space-y-4">
      {update.isError && !isPaywallError(update.error) && <Alert tone="danger">{errorMessage(update.error)}</Alert>}
      <div className="divide-text/5 divide-y">
        <Switch
          label={`Incognito${features?.incognito ? '' : ' (Premium)'}`}
          hint="Yalnızca beğendiğin kişiler seni keşfette görebilir."
          checked={settings.data.incognito}
          disabled={update.isPending}
          onChange={(value) => save({ incognito: value })}
        />
        <Switch
          label={`Sadece doğrulanmış profiller${features?.advancedFilters ? '' : ' (Plus)'}`}
          hint="Keşfette yalnızca doğrulanmış kullanıcıları göster."
          checked={settings.data.verifiedOnly}
          disabled={update.isPending}
          onChange={(value) => save({ verifiedOnly: value })}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          İlişki niyeti filtresi
          <LockHint locked={!features?.advancedFilters} />
        </legend>
        <p className="text-text-muted text-xs">Seçim yapmazsan herkes gösterilir.</p>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIP_INTENTIONS.map((intention) => (
            <Chip
              key={intention}
              selected={settings.data.intentions.includes(intention)}
              disabled={update.isPending}
              onClick={() => toggleIntention(intention)}
            >
              {INTENTION_LABELS[intention]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <Field
        label={`Passport${features?.passport ? '' : ' (Premium)'}`}
        hint="Keşfi başka bir şehirden yap. Kapatınca kendi konumuna dönersin."
      >
        <Select
          value={settings.data.passportCity ?? ''}
          disabled={update.isPending}
          onChange={(event) => save({ passportCity: event.target.value || null })}
        >
          <option value="">Kendi konumum</option>
          {KNOWN_CITIES.map((city) => (
            <option key={city.name} value={city.name}>
              {city.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
