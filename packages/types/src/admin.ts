import type {
  BillingInterval,
  Gender,
  PhotoUrlsDto,
  ReportReason,
  SubscriptionState,
  UserRole,
  VerificationStatus,
} from './index';

/** Admin paneli yalnızca ADMIN/MODERATOR rollerine açıktır; bu DTO'lar public API'de kullanılmaz. */
export type UserStatus = 'ACTIVE' | 'RESTRICTED' | 'BANNED' | 'DEACTIVATED';
export type ReportStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
export type ModerationAction = 'NONE' | 'RESTRICT' | 'BAN';
export type VerificationRequestStatus = 'AWAITING_UPLOAD' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type AdminPaymentStatus = 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AdminUserSummaryDto {
  id: string;
  email: string;
  firstName: string | null;
  username: string | null;
  role: UserRole;
  status: UserStatus;
  verificationStatus: VerificationStatus;
  plan: string;
  openReports: number;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface AdminUserDetailDto extends AdminUserSummaryDto {
  emailVerified: boolean;
  gender: Gender | null;
  age: number;
  city: string | null;
  country: string | null;
  bio: string | null;
  onboardingCompleted: boolean;
  photos: Array<{ id: string; status: string; urls: PhotoUrlsDto | null; moderationScore: number | null }>;
  subscription: {
    id: string;
    plan: string;
    interval: BillingInterval;
    state: SubscriptionState;
    currentPeriodEnd: string;
  } | null;
  stats: { likesGiven: number; likesReceived: number; matches: number; messages: number; reportsMade: number };
  overrides: Array<{ feature: string; value: string }>;
  activeSessions: number;
  recentAudit: AuditLogDto[];
}

export interface AdminReportDto {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  reporter: { id: string; firstName: string | null; username: string | null };
  reportedUser: {
    id: string;
    firstName: string | null;
    username: string | null;
    status: UserStatus;
    totalReports: number;
  };
  message: { id: string; type: 'TEXT' | 'IMAGE'; body: string | null; createdAt: string } | null;
}

export interface ModerationPhotoDto {
  id: string;
  userId: string;
  username: string | null;
  urls: PhotoUrlsDto | null;
  moderationScore: number | null;
  createdAt: string;
}

export interface AdminVerificationDto {
  id: string;
  userId: string;
  username: string | null;
  firstName: string | null;
  gesture: string;
  selfieUrl: string;
  profilePhotos: PhotoUrlsDto[];
  status: VerificationRequestStatus;
  submittedAt: string | null;
}

export interface AdminSubscriptionDto {
  id: string;
  userId: string;
  email: string;
  plan: string;
  interval: BillingInterval;
  state: SubscriptionState;
  provider: string;
  currentPeriodEnd: string;
  createdAt: string;
}

export interface AdminPaymentDto {
  id: string;
  userId: string;
  email: string;
  description: string;
  amount: number;
  currency: string;
  status: AdminPaymentStatus;
  provider: string;
  createdAt: string;
  refundedAt: string | null;
}

export interface AdminPlanDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  swipeLimit: number | null;
  superLikeLimit: number;
  boostLimit: number;
  active: boolean;
  activeSubscribers: number;
}

export interface FeatureFlagDto {
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercent: number;
  updatedAt: string;
}

export interface AuditLogDto {
  id: string;
  action: string;
  actor: { id: string; email: string } | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminDashboardDto {
  users: { total: number; active: number; new: number };
  matches: number;
  messages: number;
  openReports: number;
  pendingModeration: number;
  revenue: { last30Days: number; mrr: number; currency: string };
  subscriptions: { active: number; churnRate: number };
  conversionRate: number;
  signupsByDay: Array<{ date: string; count: number }>;
  revenueByDay: Array<{ date: string; amount: number }>;
}

/** Spec Bölüm 31 KPI'ları. Oranlar 0-1 arasıdır; para kuruş cinsindendir. */
export interface AnalyticsKpiDto {
  range: { from: string; to: string };
  dau: number;
  wau: number;
  mau: number;
  signupConversion: number | null;
  profileCompletion: number | null;
  matchRate: number | null;
  messageRate: number | null;
  retention: { d1: number | null; d7: number | null; d30: number | null };
  subscriptionConversion: number | null;
  mrr: number;
  arpu: number | null;
  churn: number | null;
  ltv: number | null;
  /** Pazarlama harcaması girilmediyse hesaplanamaz. */
  cac: number | null;
  revenuePerActiveUser: number | null;
  events: Array<{ name: string; count: number }>;
}

export interface FeatureFlagsDto {
  flags: Record<string, boolean>;
}

export interface VerificationUploadDto {
  requestId: string;
  gesture: string;
  upload: { url: string; fields: Record<string, string> };
}

export interface VerificationStateDto {
  status: VerificationStatus;
  request: { id: string; status: VerificationRequestStatus; gesture: string; rejectReason: string | null } | null;
}
