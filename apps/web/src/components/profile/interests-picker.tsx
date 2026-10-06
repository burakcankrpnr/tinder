'use client';

import type { InterestDto } from '@dating/types';
import { MAX_INTERESTS } from '@dating/validation';
import { Alert, Chip, Spinner } from '@dating/ui';
import { errorMessage } from '@/lib/api-client';
import { useInterests } from '@/lib/queries';

function groupByCategory(interests: InterestDto[]): Array<[string, InterestDto[]]> {
  const groups = new Map<string, InterestDto[]>();
  for (const interest of interests) {
    const group = groups.get(interest.category) ?? [];
    group.push(interest);
    groups.set(interest.category, group);
  }
  return [...groups];
}

export function InterestsPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const interests = useInterests();
  const selected = new Set(value);
  const full = selected.size >= MAX_INTERESTS;

  if (interests.isPending) return <Spinner className="text-primary" label="İlgi alanları yükleniyor" />;
  if (interests.isError) return <Alert tone="danger">{errorMessage(interests.error)}</Alert>;

  return (
    <div className="space-y-4">
      <p className="text-text-muted text-xs" aria-live="polite">
        {selected.size} / {MAX_INTERESTS} seçildi
      </p>
      {groupByCategory(interests.data).map(([category, items]) => (
        <fieldset key={category} className="space-y-2">
          <legend className="text-text-muted mb-2 text-xs font-medium tracking-wide uppercase">{category}</legend>
          <div className="flex flex-wrap gap-2">
            {items.map((interest) => {
              const isSelected = selected.has(interest.id);
              return (
                <Chip
                  key={interest.id}
                  selected={isSelected}
                  disabled={!isSelected && full}
                  onClick={() =>
                    onChange(
                      isSelected ? value.filter((id) => id !== interest.id) : [...value, interest.id],
                    )
                  }
                >
                  {interest.name}
                </Chip>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
