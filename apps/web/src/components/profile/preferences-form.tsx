'use client';

import type { MyProfileDto } from '@dating/types';
import {
  GENDERS,
  MAX_DISTANCE_KM,
  MAX_PREFERENCE_AGE,
  MIN_PREFERENCE_AGE,
  preferencesSchema,
} from '@dating/validation';
import { Alert, Button, Chip, Field, Input } from '@dating/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { api } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { INTERESTED_IN_LABELS } from '@/lib/labels';
import { queryKeys } from '@/lib/queries';

function defaultsFrom(me: MyProfileDto) {
  const ageMin = Math.max(MIN_PREFERENCE_AGE, me.age - 5);
  return {
    interestedIn: me.preferences?.interestedIn ?? [],
    ageMin: me.preferences?.ageMin ?? ageMin,
    ageMax: me.preferences?.ageMax ?? Math.min(MAX_PREFERENCE_AGE, Math.max(ageMin, me.age + 5)),
    maxDistanceKm: me.preferences?.maxDistanceKm ?? 50,
  };
}

export function PreferencesForm({
  me,
  submitLabel,
  onSaved,
}: {
  me: MyProfileDto;
  submitLabel: string;
  onSaved: (profile: MyProfileDto) => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(preferencesSchema), defaultValues: defaultsFrom(me) });
  const distance = useWatch({ control, name: 'maxDistanceKm' });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await api<MyProfileDto>('/profile/me/preferences', { method: 'PUT', body: values });
      queryClient.setQueryData(queryKeys.myProfile, result);
      onSaved(result);
    } catch (error) {
      setFormError(
        applyServerErrors(error, setError, ['interestedIn', 'ageMin', 'ageMax', 'maxDistanceKm']),
      );
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError && <Alert tone="danger">{formError}</Alert>}

      <Field label="Kimlerle tanışmak istiyorsun?" error={errors.interestedIn?.message}>
        <Controller
          control={control}
          name="interestedIn"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2" role="group">
              {GENDERS.map((gender) => {
                const selected = field.value.includes(gender);
                return (
                  <Chip
                    key={gender}
                    selected={selected}
                    onClick={() =>
                      field.onChange(
                        selected ? field.value.filter((item) => item !== gender) : [...field.value, gender],
                      )
                    }
                  >
                    {INTERESTED_IN_LABELS[gender]}
                  </Chip>
                );
              })}
            </div>
          )}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Minimum yaş" error={errors.ageMin?.message}>
          <Input
            type="number"
            inputMode="numeric"
            min={MIN_PREFERENCE_AGE}
            max={MAX_PREFERENCE_AGE}
            {...register('ageMin')}
          />
        </Field>
        <Field label="Maksimum yaş" error={errors.ageMax?.message}>
          <Input
            type="number"
            inputMode="numeric"
            min={MIN_PREFERENCE_AGE}
            max={MAX_PREFERENCE_AGE}
            {...register('ageMax')}
          />
        </Field>
      </div>

      <Field label={`Maksimum mesafe: ${String(distance)} km`} error={errors.maxDistanceKm?.message}>
        <Input
          type="range"
          min={1}
          max={MAX_DISTANCE_KM}
          step={1}
          className="accent-primary h-auto border-none bg-transparent px-0"
          {...register('maxDistanceKm')}
        />
      </Field>

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
