'use client';

import type {
  InterestDto,
  MyProfileDto,
  OnboardingStep,
  PhotoDto,
  PublicProfileDto,
} from '@dating/types';
import { useQuery } from '@tanstack/react-query';
import { api } from './api-client';
import { useAuth } from './auth-context';

export const queryKeys = {
  myProfile: ['profile', 'me'] as const,
  photos: ['photos'] as const,
  interests: ['interests'] as const,
  publicProfile: (username: string) => ['profiles', username] as const,
};

export function fetchMyProfile(): Promise<MyProfileDto> {
  return api<MyProfileDto>('/profile/me');
}

export function useMyProfile() {
  const { state } = useAuth();
  return useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: fetchMyProfile,
    enabled: state.status === 'authenticated',
  });
}

export function usePhotos(options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.photos,
    queryFn: () => api<PhotoDto[]>('/photos'),
    refetchInterval: (query) =>
      options.poll && query.state.data?.some((photo) => photo.status === 'PROCESSING') ? 2_000 : false,
  });
}

export function useInterests() {
  return useQuery({
    queryKey: queryKeys.interests,
    queryFn: () => api<InterestDto[]>('/interests'),
    staleTime: 60 * 60_000,
  });
}

export function usePublicProfile(username: string) {
  return useQuery({
    queryKey: queryKeys.publicProfile(username),
    queryFn: () => api<PublicProfileDto>(`/profiles/${encodeURIComponent(username)}`),
  });
}

export const ONBOARDING_STEPS: ReadonlyArray<{ step: OnboardingStep; label: string }> = [
  { step: 'profile', label: 'Profil' },
  { step: 'photos', label: 'Fotoğraflar' },
  { step: 'preferences', label: 'Tercihler' },
  { step: 'location', label: 'Konum' },
];

/** Girişten sonra kullanıcının gitmesi gereken sayfa. */
export function homePathFor(profile: MyProfileDto, next?: string | null): string {
  if (!profile.onboarding.completed) {
    return `/onboarding/${profile.onboarding.nextStep ?? 'location'}`;
  }
  return safeNextPath(next) ?? '/profile';
}

export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  return next;
}
