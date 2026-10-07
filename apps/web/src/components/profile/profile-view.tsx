'use client';

import type { MyProfileDto, PublicProfileDto } from '@dating/types';
import { Card, Tag, cx } from '@dating/ui';
import Image from 'next/image';
import { useState } from 'react';
import {
  COMMUNICATION_LABELS,
  EDUCATION_LEVEL_LABELS,
  EXERCISE_LABELS,
  FREQUENCY_LABELS,
  GENDER_LABELS,
  INTENTION_LABELS,
  KIDS_LABELS,
  LOVE_LABELS,
  PET_LABELS,
  SEXUAL_ORIENTATION_LABELS,
  SOCIAL_LABELS,
  ZODIAC_LABELS,
  languageLabel,
} from '@/lib/labels';

/** Kendi profilini, başkalarının göreceği public görünümle önizlemek için. */
export function toPublicView(me: MyProfileDto, id: string): PublicProfileDto | null {
  const profile = me.profile;
  if (!profile) return null;
  return {
    id,
    firstName: profile.firstName,
    username: profile.username,
    age: me.controls.hideAge ? null : me.age,
    gender: profile.gender,
    bio: profile.bio,
    city: profile.city,
    country: profile.country,
    occupation: profile.occupation,
    education: profile.education,
    educationLevel: profile.educationLevel,
    sexualOrientation: profile.sexualOrientation,
    zodiac: me.zodiac,
    kids: profile.kids,
    communicationStyle: profile.communicationStyle,
    loveStyle: profile.loveStyle,
    heightCm: profile.heightCm,
    languages: profile.languages,
    relationshipIntention: profile.relationshipIntention,
    lifestyle: {
      drinking: profile.drinking,
      smoking: profile.smoking,
      exercise: profile.exercise,
      pets: profile.pets,
      socialMedia: profile.socialMedia,
    },
    interests: me.interests.map(({ slug, name }) => ({ slug, name })),
    photos: me.photos.flatMap((photo) =>
      photo.status === 'APPROVED' && photo.urls
        ? [{ id: photo.id, contentType: photo.contentType, urls: photo.urls }]
        : [],
    ),
    verified: profile.verificationStatus === 'VERIFIED',
  };
}

function PhotoGallery({ profile }: { profile: PublicProfileDto }) {
  const [index, setIndex] = useState(0);
  const photo = profile.photos[Math.min(index, profile.photos.length - 1)];

  if (!photo) {
    return (
      <div className="bg-surface-2 text-text-muted flex aspect-[3/4] items-center justify-center rounded-card text-sm">
        Henüz onaylı fotoğraf yok
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-surface-2 relative aspect-[3/4] overflow-hidden rounded-card">
        <Image
          src={photo.urls.large}
          alt={`${profile.firstName} - fotoğraf ${index + 1}`}
          fill
          unoptimized
          priority
          sizes="(min-width: 768px) 400px, 100vw"
          className="object-cover"
        />
      </div>
      {profile.photos.length > 1 && (
        <div className="flex gap-2" role="group" aria-label="Fotoğraflar">
          {profile.photos.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(itemIndex)}
              aria-label={`Fotoğraf ${itemIndex + 1}`}
              aria-pressed={itemIndex === index}
              className={cx(
                'relative size-14 overflow-hidden rounded-xl border-2 transition',
                itemIndex === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100',
              )}
            >
              <Image src={item.urls.thumb} alt="" fill unoptimized sizes="56px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-text-muted text-xs">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export function ProfileView({ profile }: { profile: PublicProfileDto }) {
  const { lifestyle } = profile;

  return (
    <div className="grid gap-6 md:grid-cols-[400px_1fr]">
      <PhotoGallery profile={profile} />
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            {profile.firstName}
            {profile.age != null ? `, ${profile.age}` : ''}
            {profile.verified && (
              <span className="bg-primary/20 text-primary-soft rounded-full px-2.5 py-0.5 text-xs font-medium">
                Doğrulanmış
              </span>
            )}
          </h1>
          <p className="text-text-muted text-sm">
            @{profile.username}
            {profile.city && ` · ${profile.city}`}
          </p>
        </header>

        {profile.bio && (
          <Card className="p-5">
            <h2 className="text-text-muted mb-2 text-xs font-medium tracking-wide uppercase">Hakkında</h2>
            <p className="text-sm leading-relaxed whitespace-pre-line">{profile.bio}</p>
          </Card>
        )}

        <Card className="p-5">
          <dl className="grid grid-cols-2 gap-4">
            <Detail label="Cinsiyet" value={GENDER_LABELS[profile.gender]} />
            <Detail
              label="Aradığı"
              value={profile.relationshipIntention ? INTENTION_LABELS[profile.relationshipIntention] : null}
            />
            <Detail label="Meslek" value={profile.occupation} />
            <Detail label="Eğitim seviyesi" value={profile.educationLevel ? EDUCATION_LEVEL_LABELS[profile.educationLevel] : null} />
            <Detail label="Üniversite" value={profile.education} />
            <Detail label="Yönelim" value={profile.sexualOrientation ? SEXUAL_ORIENTATION_LABELS[profile.sexualOrientation] : null} />
            <Detail label="Burç" value={ZODIAC_LABELS[profile.zodiac]} />
            <Detail label="Çocuk" value={profile.kids ? KIDS_LABELS[profile.kids] : null} />
            <Detail label="İletişim" value={profile.communicationStyle ? COMMUNICATION_LABELS[profile.communicationStyle] : null} />
            <Detail label="Aşk dili" value={profile.loveStyle ? LOVE_LABELS[profile.loveStyle] : null} />
            <Detail label="Boy" value={profile.heightCm ? `${profile.heightCm} cm` : null} />
            <Detail label="Diller" value={profile.languages.map(languageLabel).join(', ')} />
            <Detail label="Alkol" value={lifestyle.drinking ? FREQUENCY_LABELS[lifestyle.drinking] : null} />
            <Detail label="Sigara" value={lifestyle.smoking ? FREQUENCY_LABELS[lifestyle.smoking] : null} />
            <Detail label="Spor" value={lifestyle.exercise ? EXERCISE_LABELS[lifestyle.exercise] : null} />
            <Detail label="Evcil hayvan" value={lifestyle.pets ? PET_LABELS[lifestyle.pets] : null} />
            <Detail label="Sosyal medya" value={lifestyle.socialMedia ? SOCIAL_LABELS[lifestyle.socialMedia] : null} />
          </dl>
        </Card>

        {profile.interests.length > 0 && (
          <section>
            <h2 className="text-text-muted mb-2 text-xs font-medium tracking-wide uppercase">İlgi alanları</h2>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((interest) => (
                <Tag key={interest.slug}>{interest.name}</Tag>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
