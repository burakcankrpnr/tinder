'use client';

import type {
  AdminDashboardDto,
  AdminPaymentDto,
  AdminPlanDto,
  AdminReportDto,
  AdminSubscriptionDto,
  AdminUserDetailDto,
  AdminUserSummaryDto,
  AdminVerificationDto,
  AnalyticsKpiDto,
  AuditLogDto,
  FeatureFlagDto,
  ModerationPhotoDto,
  Page,
} from '@dating/types';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api-client';

export const adminKeys = {
  dashboard: (days: number) => ['admin', 'dashboard', days] as const,
  users: (params: string) => ['admin', 'users', params] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  reports: (params: string) => ['admin', 'reports', params] as const,
  photos: ['admin', 'moderation', 'photos'] as const,
  verifications: ['admin', 'moderation', 'verifications'] as const,
  subscriptions: (params: string) => ['admin', 'subscriptions', params] as const,
  payments: (params: string) => ['admin', 'payments', params] as const,
  plans: ['admin', 'plans'] as const,
  flags: ['admin', 'flags'] as const,
  analytics: (params: string) => ['admin', 'analytics', params] as const,
  audit: ['admin', 'audit'] as const,
};

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

function usePagedQuery<T>(key: readonly unknown[], path: string, params: Record<string, string | number | undefined>) {
  const query = qs(params);
  return useInfiniteQuery({
    queryKey: [...key, query],
    queryFn: ({ pageParam }) =>
      api<Page<T>>(`${path}${qs({ ...params, cursor: pageParam })}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useAdminDashboard(days = 30) {
  return useQuery({
    queryKey: adminKeys.dashboard(days),
    queryFn: () => api<AdminDashboardDto>(`/admin/dashboard?days=${days}`),
  });
}

export function useAdminUsers(params: { q?: string; status?: string; role?: string }) {
  return usePagedQuery<AdminUserSummaryDto>(adminKeys.users('list'), '/admin/users', params);
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: adminKeys.user(id),
    queryFn: () => api<AdminUserDetailDto>(`/admin/users/${id}`),
    enabled: Boolean(id),
  });
}

export function useAdminReports(params: { status?: string; reason?: string }) {
  return usePagedQuery<AdminReportDto>(adminKeys.reports('list'), '/admin/reports', params);
}

export function useModerationPhotos() {
  return usePagedQuery<ModerationPhotoDto>(adminKeys.photos, '/admin/moderation/photos', {});
}

export function useModerationVerifications() {
  return usePagedQuery<AdminVerificationDto>(adminKeys.verifications, '/admin/moderation/verifications', {});
}

export function useAdminSubscriptions(params: { state?: string; plan?: string }) {
  return usePagedQuery<AdminSubscriptionDto>(adminKeys.subscriptions('list'), '/admin/subscriptions', params);
}

export function useAdminPayments(params: { status?: string }) {
  return usePagedQuery<AdminPaymentDto>(adminKeys.payments('list'), '/admin/payments', params);
}

export function useAdminPlans() {
  return useQuery({ queryKey: adminKeys.plans, queryFn: () => api<AdminPlanDto[]>('/admin/plans') });
}

export function useAdminFlags() {
  return useQuery({ queryKey: adminKeys.flags, queryFn: () => api<FeatureFlagDto[]>('/admin/feature-flags') });
}

export function useAdminAnalytics(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: adminKeys.analytics(qs(params)),
    queryFn: () => api<AnalyticsKpiDto>(`/admin/analytics${qs(params)}`),
  });
}

export function useAdminAudit(params: { action?: string }) {
  return usePagedQuery<AuditLogDto>(adminKeys.audit, '/admin/audit-logs', params);
}

export function useInvalidateAdmin() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['admin'] });
}
