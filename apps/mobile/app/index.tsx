import type { MyProfileDto, OnboardingStep } from '@dating/types';
import { api } from '@/api';
import { useSession } from '@/session';
import { BrandSplash } from '@/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

function destination(profile: MyProfileDto): '/discover' | `/onboarding/${OnboardingStep}` {
  const step = profile.onboarding.nextStep;
  if (!profile.onboarding.completed && step) return `/onboarding/${step}`;
  return '/discover';
}

export default function Index() {
  const { status } = useSession();
  const router = useRouter();
  const profile = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => api<MyProfileDto>('/profile/me'),
    enabled: status === 'authenticated',
  });

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
    if (status === 'authenticated' && profile.data) router.replace(destination(profile.data));
    if (status === 'authenticated' && profile.isError) router.replace('/discover');
  }, [profile.data, profile.isError, router, status]);

  return <BrandSplash />;
}
