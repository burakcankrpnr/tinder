export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INVALID_CREDENTIALS',
  'ACCOUNT_LOCKED',
  'EMAIL_NOT_VERIFIED',
  'INVALID_TOKEN',
  'FEATURE_DISABLED',
  /** Paket limiti doldu; istemci paywall açar. */
  'LIMIT_REACHED',
  /** Özellik mevcut pakette yok; istemci paywall açar. */
  'FEATURE_LOCKED',
  'INVALID_SIGNATURE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  requestId?: string;
  details?: Array<{ path: string; message: string }>;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN';

export interface CurrentUserDto {
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  createdAt: string;
}

export interface AuthResultDto {
  accessToken: string;
  expiresIn: number;
  user: CurrentUserDto;
  /** Yalnızca `X-Client: mobile` isteklerinde döner. Web httpOnly cookie kullanır. */
  refreshToken?: string;
}

export interface SessionDto {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  lastUsedAt: string;
  createdAt: string;
  current: boolean;
}

export interface MessageDto {
  message: string;
}

export type Gender = 'WOMAN' | 'MAN' | 'NON_BINARY';
export type RelationshipIntention =
  | 'LONG_TERM'
  | 'LONG_TERM_OPEN_TO_SHORT'
  | 'SHORT_TERM_OPEN_TO_LONG'
  | 'SHORT_TERM'
  | 'FRIENDSHIP'
  | 'NOT_SURE';
export type LifestyleFrequency = 'NEVER' | 'SOMETIMES' | 'OFTEN';
export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
export type PhotoStatus =
  | 'PENDING_UPLOAD'
  | 'PROCESSING'
  | 'APPROVED'
  | 'PENDING_REVIEW'
  | 'REJECTED';
export type OnboardingStep = 'profile' | 'photos' | 'preferences' | 'location';

export interface PhotoUrlsDto {
  thumb: string;
  medium: string;
  large: string;
}

export interface PhotoDto {
  id: string;
  position: number;
  status: PhotoStatus;
  contentType: string;
  urls: PhotoUrlsDto | null;
  width: number | null;
  height: number | null;
  rejectReason: string | null;
}

export interface PhotoUploadDto {
  photo: PhotoDto;
  upload: { url: string; fields: Record<string, string> };
}

export interface InterestDto {
  id: number;
  slug: string;
  name: string;
  category: string;
}

export interface ProfileBasicsDto {
  firstName: string;
  username: string;
  gender: Gender;
  bio: string | null;
  city: string | null;
  country: string | null;
  occupation: string | null;
  education: string | null;
  heightCm: number | null;
  languages: string[];
  relationshipIntention: RelationshipIntention | null;
  drinking: LifestyleFrequency | null;
  smoking: LifestyleFrequency | null;
  exercise: LifestyleFrequency | null;
}

export interface MyProfileDto {
  age: number;
  profile:
    | (ProfileBasicsDto & {
        verificationStatus: VerificationStatus;
        hasLocation: boolean;
        locationUpdatedAt: string | null;
      })
    | null;
  preferences: {
    interestedIn: Gender[];
    ageMin: number;
    ageMax: number;
    maxDistanceKm: number;
  } | null;
  interests: InterestDto[];
  photos: PhotoDto[];
  completeness: number;
  onboarding: { completed: boolean; nextStep: OnboardingStep | null };
}

export interface PublicProfileDto {
  id: string;
  firstName: string;
  username: string;
  age: number;
  gender: Gender;
  bio: string | null;
  city: string | null;
  country: string | null;
  occupation: string | null;
  education: string | null;
  heightCm: number | null;
  languages: string[];
  relationshipIntention: RelationshipIntention | null;
  lifestyle: {
    drinking: LifestyleFrequency | null;
    smoking: LifestyleFrequency | null;
    exercise: LifestyleFrequency | null;
  };
  interests: Array<Pick<InterestDto, 'slug' | 'name'>>;
  photos: Array<{ id: string; contentType: string; urls: PhotoUrlsDto }>;
  verified: boolean;
}

export type SwipeAction = 'LIKE' | 'PASS' | 'SUPER_LIKE';

export interface DiscoveryCardDto extends PublicProfileDto {
  /** Tam sayıya yuvarlanmış, en az 1 km; kesin konum açığa çıkmaz. */
  distanceKm: number;
  commonInterests: string[];
  /** Bu kişi seni Super Like'ladı. */
  superLikedYou: boolean;
}

export interface DiscoveryFeedDto {
  cards: DiscoveryCardDto[];
  /** Kart yoksa kullanıcıya önerilecek aksiyonlar (spec Bölüm 37). */
  suggestions: Array<'INCREASE_DISTANCE' | 'WIDEN_AGE_RANGE' | 'TRY_LATER'>;
}

export interface MatchUserDto {
  id: string;
  firstName: string;
  username: string;
  age: number;
  photo: PhotoUrlsDto | null;
}

export interface MatchSummaryDto {
  id: string;
  createdAt: string;
  user: MatchUserDto;
}

export interface SwipeResultDto {
  action: SwipeAction;
  match: MatchSummaryDto | null;
}

export type MessageType = 'TEXT' | 'IMAGE';

export interface ChatMessageDto {
  id: string;
  clientMessageId: string;
  matchId: string;
  senderId: string;
  type: MessageType;
  body: string | null;
  image: { url: string; width: number | null; height: number | null } | null;
  createdAt: string;
  readAt: string | null;
  deleted: boolean;
}

export interface MatchListItemDto extends MatchSummaryDto {
  lastMessage: {
    preview: string;
    type: MessageType;
    fromMe: boolean;
    createdAt: string;
    deleted: boolean;
  } | null;
  unreadCount: number;
  online: boolean;
}

export interface MatchListDto {
  matches: MatchListItemDto[];
}

export interface MatchDetailDto extends MatchSummaryDto {
  online: boolean;
  lastActiveAt: string | null;
}

export interface MessagePageDto {
  messages: ChatMessageDto[];
  /** Daha eski mesaj varsa bir sonraki sayfa için `before` cursor'ı. */
  nextCursor: string | null;
}

export interface ChatAttachmentUploadDto {
  attachmentKey: string;
  upload: { url: string; fields: Record<string, string> };
}

export type ReportReason =
  | 'FAKE_PROFILE'
  | 'HARASSMENT'
  | 'SCAM'
  | 'SPAM'
  | 'SEXUAL_CONTENT'
  | 'VIOLENCE'
  | 'UNDERAGE'
  | 'OTHER';

export interface ReportCreatedDto {
  id: string;
  blocked: boolean;
}

export interface BlockedUserDto {
  userId: string;
  firstName: string;
  username: string;
  photo: PhotoUrlsDto | null;
  blockedAt: string;
}

export type NotificationType =
  | 'NEW_MATCH'
  | 'NEW_MESSAGE'
  | 'SOMEONE_LIKED_YOU'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_EXPIRING'
  | 'PAYMENT_FAILED';

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Uygulama içi yönlendirme yolu (ör. /matches/<id>). */
  href: string | null;
  count: number;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPageDto {
  notifications: NotificationDto[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface NotificationPreferencesDto {
  newMatch: boolean;
  newMessage: boolean;
  someoneLikedYou: boolean;
  billing: boolean;
  email: boolean;
  push: boolean;
}

export interface PushConfigDto {
  enabled: boolean;
  publicKey: string | null;
}

/** Socket.IO olayları: sunucu → istemci. */
export interface ServerToClientEvents {
  'message:new': (message: ChatMessageDto) => void;
  'message:deleted': (payload: { matchId: string; messageId: string }) => void;
  'message:read': (payload: { matchId: string; readerId: string; readAt: string; upToMessageId: string }) => void;
  typing: (payload: { matchId: string; userId: string; isTyping: boolean }) => void;
  presence: (payload: { userId: string; online: boolean }) => void;
  'match:new': (match: MatchSummaryDto) => void;
  'match:ended': (payload: { matchId: string }) => void;
  'notification:new': (notification: NotificationDto) => void;
}

export type SocketAck<T> = (response: ApiResponse<T>) => void;

/** Socket.IO olayları: istemci → sunucu. */
export interface ClientToServerEvents {
  typing: (payload: { matchId: string; isTyping: boolean }) => void;
  'message:send': (
    payload: { matchId: string; message: unknown },
    ack: SocketAck<ChatMessageDto>,
  ) => void;
}

export type BillingInterval = 'MONTHLY' | 'YEARLY';
export type EntitlementType = 'SUPER_LIKE' | 'BOOST';

/** Fiyatlar kuruş (minor unit) cinsindendir. */
export interface PlanDto {
  slug: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  /** Yıllık ödemenin 12 aylık ödemeye göre tasarruf yüzdesi. */
  yearlySavingsPercent: number;
  features: string[];
  limits: { dailyLikes: number | null; superLikesPerWeek: number; boostsPerMonth: number };
  perks: {
    rewind: boolean;
    seeLikes: boolean;
    incognito: boolean;
    passport: boolean;
    advancedFilters: boolean;
    adFree: boolean;
    priorityVisibility: boolean;
  };
}

export interface ProductDto {
  slug: string;
  name: string;
  description: string | null;
  type: EntitlementType;
  quantity: number;
  price: number;
  currency: string;
}

export interface CatalogDto {
  plans: PlanDto[];
  products: ProductDto[];
}

/** Spec Bölüm 39 lifecycle'ının kullanıcıya gösterilen hali. */
export type SubscriptionState = 'ACTIVE' | 'CANCEL_AT_PERIOD_END' | 'GRACE_PERIOD' | 'EXPIRED';

export interface SubscriptionDto {
  id: string;
  plan: { slug: string; name: string };
  interval: BillingInterval;
  state: SubscriptionState;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  graceUntil: string | null;
}

export interface LikeAllowanceDto {
  allowed: boolean;
  /** null = sınırsız */
  limit: number | null;
  remaining: number | null;
  resetAt: string;
}

export interface EntitlementsDto {
  plan: { slug: string; name: string };
  subscription: SubscriptionDto | null;
  features: {
    rewind: boolean;
    seeLikes: boolean;
    incognito: boolean;
    passport: boolean;
    advancedFilters: boolean;
    adFree: boolean;
  };
  likes: LikeAllowanceDto;
  superLikes: { remaining: number };
  boosts: { remaining: number; activeUntil: string | null };
}

export interface CheckoutDto {
  checkoutId: string;
  /** Kullanıcının ödeme için yönlendirileceği provider sayfası. */
  url: string;
}

export interface MockCheckoutDto {
  checkoutId: string;
  status: 'OPEN' | 'COMPLETED' | 'FAILED' | 'CANCELED' | 'EXPIRED';
  description: string;
  amount: number;
  currency: string;
}

export interface PaymentDto {
  id: string;
  description: string;
  amount: number;
  currency: string;
  status: 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  createdAt: string;
}

export interface LikerDto extends DiscoveryCardDto {
  likedAt: string;
}

export interface LikesReceivedDto {
  /** Paket "beğenenleri gör" içermiyorsa yalnızca sayı döner. */
  locked: boolean;
  total: number;
  items: LikerDto[];
}

export interface RewindResultDto {
  /** Kişi artık görünür değilse (engel, hesap kapanışı) null. */
  card: DiscoveryCardDto | null;
}

export interface BoostDto {
  startedAt: string;
  endsAt: string;
}

export interface PremiumSettingsDto {
  incognito: boolean;
  passportCity: string | null;
  verifiedOnly: boolean;
  intentions: RelationshipIntention[];
}

export interface UsernameAvailabilityDto {
  available: boolean;
}

export interface HealthDto {
  status: 'ok' | 'degraded';
  checks: { database: boolean; redis: boolean; storage: boolean };
}

export * from './admin';
