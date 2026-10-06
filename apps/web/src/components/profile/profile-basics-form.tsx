'use client';

import type { MyProfileDto, UsernameAvailabilityDto } from '@dating/types';
import {
  GENDERS,
  LIFESTYLE_FREQUENCIES,
  MAX_BIO_LENGTH,
  MAX_LANGUAGES,
  RELATIONSHIP_INTENTIONS,
  type ProfileBasicsFormInput,
  type ProfileBasicsInput,
  profileBasicsSchema,
  usernameSchema,
} from '@dating/validation';
import { Alert, Button, Chip, Field, Input, Select, Textarea } from '@dating/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, type DefaultValues, useForm, useWatch } from 'react-hook-form';
import { ApiError, api } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import {
  FREQUENCY_LABELS,
  GENDER_LABELS,
  INTENTION_LABELS,
  LANGUAGE_LABELS,
} from '@/lib/labels';
import { queryKeys } from '@/lib/queries';
import { InterestsPicker } from './interests-picker';

type Availability = 'idle' | 'checking' | 'available' | 'taken';

const FIELDS = [
  'firstName',
  'username',
  'gender',
  'bio',
  'city',
  'country',
  'occupation',
  'education',
  'heightCm',
  'languages',
  'relationshipIntention',
  'drinking',
  'smoking',
  'exercise',
] as const;

function defaultsFrom(me: MyProfileDto): DefaultValues<ProfileBasicsFormInput> {
  const profile = me.profile;
  return {
    firstName: profile?.firstName ?? '',
    username: profile?.username ?? '',
    gender: profile?.gender,
    bio: profile?.bio ?? '',
    city: profile?.city ?? '',
    country: profile?.country ?? 'TR',
    occupation: profile?.occupation ?? '',
    education: profile?.education ?? '',
    heightCm: profile?.heightCm ?? '',
    languages: profile?.languages ?? [],
    relationshipIntention: profile?.relationshipIntention ?? '',
    drinking: profile?.drinking ?? '',
    smoking: profile?.smoking ?? '',
    exercise: profile?.exercise ?? '',
  };
}

function useUsernameAvailability(username: string, current: string | undefined): Availability {
  const [availability, setAvailability] = useState<Availability>('idle');

  useEffect(() => {
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success || parsed.data === current) {
      setAvailability('idle');
      return;
    }
    setAvailability('checking');
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<UsernameAvailabilityDto>(
        `/profile/username-available?username=${encodeURIComponent(parsed.data)}`,
        { signal: controller.signal },
      )
        .then((result) => setAvailability(result.available ? 'available' : 'taken'))
        .catch(() => setAvailability('idle'));
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username, current]);

  return availability;
}

export function ProfileBasicsForm({
  me,
  submitLabel,
  onSaved,
}: {
  me: MyProfileDto;
  submitLabel: string;
  onSaved: (profile: MyProfileDto) => void;
}) {
  const queryClient = useQueryClient();
  const [interestIds, setInterestIds] = useState(() => me.interests.map((interest) => interest.id));
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileBasicsFormInput, unknown, ProfileBasicsInput>({
    resolver: zodResolver(profileBasicsSchema),
    defaultValues: defaultsFrom(me),
  });

  const username = useWatch({ control, name: 'username' });
  const bio = useWatch({ control, name: 'bio' });
  const availability = useUsernameAvailability(username, me.profile?.username);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (availability === 'taken') {
      setError('username', { message: 'Bu kullanıcı adı alınmış.' });
      return;
    }
    try {
      let result = await api<MyProfileDto>('/profile/me', { method: 'PUT', body: values });
      const currentIds = new Set(me.interests.map((interest) => interest.id));
      const changed =
        currentIds.size !== interestIds.length || interestIds.some((id) => !currentIds.has(id));
      if (changed) {
        result = await api<MyProfileDto>('/profile/me/interests', {
          method: 'PUT',
          body: { interestIds },
        });
      }
      queryClient.setQueryData(queryKeys.myProfile, result);
      onSaved(result);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CONFLICT') {
        setError('username', { message: error.message });
        return;
      }
      setFormError(applyServerErrors(error, setError, FIELDS));
    }
  });

  const usernameHint =
    availability === 'checking'
      ? 'Kontrol ediliyor…'
      : availability === 'available'
        ? 'Bu kullanıcı adı uygun.'
        : 'Harf, rakam, nokta ve alt çizgi; 3-20 karakter.';

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {formError && <Alert tone="danger">{formError}</Alert>}

      <section className="space-y-4" aria-labelledby="basics-heading">
        <h2 id="basics-heading" className="text-lg font-semibold">
          Temel bilgiler
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="İsim" error={errors.firstName?.message}>
            <Input autoComplete="given-name" {...register('firstName')} />
          </Field>
          <Field
            label="Kullanıcı adı"
            error={errors.username?.message ?? (availability === 'taken' ? 'Bu kullanıcı adı alınmış.' : undefined)}
            hint={usernameHint}
          >
            <Input autoComplete="username" autoCapitalize="none" spellCheck={false} {...register('username')} />
          </Field>
          <Field label="Cinsiyet" error={errors.gender?.message}>
            <Select {...register('gender')}>
              <option value="">Seç</option>
              {GENDERS.map((gender) => (
                <option key={gender} value={gender}>
                  {GENDER_LABELS[gender]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ne arıyorsun?" error={errors.relationshipIntention?.message} optional>
            <Select {...register('relationshipIntention')}>
              <option value="">Belirtme</option>
              {RELATIONSHIP_INTENTIONS.map((intention) => (
                <option key={intention} value={intention}>
                  {INTENTION_LABELS[intention]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Hakkında"
          error={errors.bio?.message}
          hint={`${bio?.length ?? 0} / ${MAX_BIO_LENGTH}`}
          optional
        >
          <Textarea maxLength={MAX_BIO_LENGTH} placeholder="Kendinden biraz bahset…" {...register('bio')} />
        </Field>
      </section>

      <section className="space-y-4" aria-labelledby="details-heading">
        <h2 id="details-heading" className="text-lg font-semibold">
          Detaylar
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Şehir" error={errors.city?.message} optional>
            <Input autoComplete="address-level2" {...register('city')} />
          </Field>
          <Field label="Ülke kodu" error={errors.country?.message} hint="ör. TR" optional>
            <Input maxLength={2} autoComplete="country" className="uppercase" {...register('country')} />
          </Field>
          <Field label="Meslek" error={errors.occupation?.message} optional>
            <Input autoComplete="organization-title" {...register('occupation')} />
          </Field>
          <Field label="Eğitim" error={errors.education?.message} optional>
            <Input {...register('education')} />
          </Field>
          <Field label="Boy (cm)" error={errors.heightCm?.message} optional>
            <Input type="number" inputMode="numeric" min={120} max={230} {...register('heightCm')} />
          </Field>
        </div>
        <Field label={`Konuştuğun diller (en fazla ${MAX_LANGUAGES})`} error={errors.languages?.message} optional>
          <Controller
            control={control}
            name="languages"
            render={({ field }) => {
              const value = field.value ?? [];
              return (
                <div className="flex flex-wrap gap-2" role="group">
                  {Object.entries(LANGUAGE_LABELS).map(([code, label]) => {
                    const selected = value.includes(code);
                    return (
                      <Chip
                        key={code}
                        selected={selected}
                        disabled={!selected && value.length >= MAX_LANGUAGES}
                        onClick={() =>
                          field.onChange(selected ? value.filter((item) => item !== code) : [...value, code])
                        }
                      >
                        {label}
                      </Chip>
                    );
                  })}
                </div>
              );
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          {(['drinking', 'smoking', 'exercise'] as const).map((name) => (
            <Field
              key={name}
              label={{ drinking: 'Alkol', smoking: 'Sigara', exercise: 'Spor' }[name]}
              error={errors[name]?.message}
              optional
            >
              <Select {...register(name)}>
                <option value="">Belirtme</option>
                {LIFESTYLE_FREQUENCIES.map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {FREQUENCY_LABELS[frequency]}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="interests-heading">
        <h2 id="interests-heading" className="text-lg font-semibold">
          İlgi alanları
        </h2>
        <InterestsPicker value={interestIds} onChange={setInterestIds} />
      </section>

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
