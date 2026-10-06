import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import {
  type AdminCancelSubscriptionInput,
  type AdminPaymentsQuery,
  type AdminReportsQuery,
  type AdminSubscriptionsQuery,
  type AdminUsersQuery,
  type AnalyticsQuery,
  type AuditQuery,
  type CreateFeatureFlagInput,
  type DashboardQuery,
  type FeatureOverrideInput,
  type GrantEntitlementInput,
  type ModerationDecisionInput,
  type QueueQuery,
  type RefundInput,
  type ResolveReportInput,
  type UpdateFeatureFlagInput,
  type UpdatePlanInput,
  type UpdateUserRoleInput,
  type UpdateUserStatusInput,
  adminCancelSubscriptionSchema,
  adminPaymentsQuerySchema,
  adminReportsQuerySchema,
  adminSubscriptionsQuerySchema,
  adminUsersQuerySchema,
  analyticsQuerySchema,
  auditQuerySchema,
  createFeatureFlagSchema,
  dashboardQuerySchema,
  featureOverrideSchema,
  flagKeyParamSchema,
  grantEntitlementSchema,
  idParamSchema,
  moderationDecisionSchema,
  overrideFeatureParamSchema,
  queueQuerySchema,
  refundSchema,
  resolveReportSchema,
  updateFeatureFlagSchema,
  updatePlanSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '@dating/validation';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { AnalyticsKpiService } from '../analytics/analytics-kpi.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { VerificationService } from '../verification/verification.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminBillingService } from './admin-billing.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminModerationService } from './admin-moderation.service';
import { AdminUsersService } from './admin-users.service';

const idParam = new ZodValidationPipe(idParamSchema);
const queueQuery = new ZodValidationPipe(queueQuerySchema);

/** Moderatör ve admin: kullanıcı inceleme ve moderasyon kuyrukları. */
@Roles('ADMIN', 'MODERATOR')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('admin')
export class AdminModerationController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly moderation: AdminModerationService,
    private readonly verification: VerificationService,
  ) {}

  @Get('users')
  listUsers(@Query(new ZodValidationPipe(adminUsersQuerySchema)) query: AdminUsersQuery): Promise<Page<AdminUserSummaryDto>> {
    return this.users.list(query);
  }

  @Get('users/:id')
  user(@Param(idParam) params: { id: string }): Promise<AdminUserDetailDto> {
    return this.users.detail(params.id);
  }

  @Patch('users/:id/status')
  updateStatus(
    @CurrentUser() actor: AuthUser,
    @Param(idParam) params: { id: string },
    @Body(new ZodValidationPipe(updateUserStatusSchema)) body: UpdateUserStatusInput,
  ): Promise<AdminUserDetailDto> {
    return this.users.updateStatus(actor, params.id, body);
  }

  @Get('reports')
  reports(@Query(new ZodValidationPipe(adminReportsQuerySchema)) query: AdminReportsQuery): Promise<Page<AdminReportDto>> {
    return this.moderation.reports(query);
  }

  @Get('reports/:id')
  report(@Param(idParam) params: { id: string }): Promise<AdminReportDto> {
    return this.moderation.report(params.id);
  }

  @Post('reports/:id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @CurrentUser() actor: AuthUser,
    @Param(idParam) params: { id: string },
    @Body(new ZodValidationPipe(resolveReportSchema)) body: ResolveReportInput,
  ): Promise<AdminReportDto> {
    return this.moderation.resolve(actor, params.id, body);
  }

  @Get('moderation/photos')
  photos(@Query(queueQuery) query: QueueQuery): Promise<Page<ModerationPhotoDto>> {
    return this.moderation.pendingPhotos(query.cursor, query.limit);
  }

  @Post('moderation/photos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  decidePhoto(
    @CurrentUser() actor: AuthUser,
    @Param(idParam) params: { id: string },
    @Body(new ZodValidationPipe(moderationDecisionSchema)) body: ModerationDecisionInput,
  ): Promise<void> {
    return this.moderation.decidePhoto(actor, params.id, body);
  }

  @Get('moderation/verifications')
  verifications(@Query(queueQuery) query: QueueQuery): Promise<Page<AdminVerificationDto>> {
    return this.verification.pending(query.cursor, query.limit);
  }

  @Post('moderation/verifications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  decideVerification(
    @CurrentUser() actor: AuthUser,
    @Param(idParam) params: { id: string },
    @Body(new ZodValidationPipe(moderationDecisionSchema)) body: ModerationDecisionInput,
  ): Promise<void> {
    return this.verification.review(actor.id, params.id, body);
  }
}

/** Yalnızca admin: rol, paket, ödeme, analitik, flag ve audit. */
@Roles('ADMIN')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly billing: AdminBillingService,
    private readonly dashboardService: AdminDashboardService,
    private readonly kpis: AnalyticsKpiService,
    private readonly flags: FeatureFlagsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('dashboard')
  dashboard(@Query(new ZodValidationPipe(dashboardQuerySchema)) query: DashboardQuery): Promise<AdminDashboardDto> {
    return this.dashboardService.dashboard(query.days);
  }

  @Get('analytics')
  analytics(@Query(new ZodValidationPipe(analyticsQuerySchema)) query: AnalyticsQuery): Promise<AnalyticsKpiDto> {
    return this.kpis.kpis(query);
  }

  @Patch('users/:id/role')
  updateRole(
    @CurrentUser() actor: AuthUser,
    @Param(idParam) params: { id: string },
    @Body(new ZodValidationPipe(updateUserRoleSchema)) body: UpdateUserRoleInput,
  ): Promise<AdminUserDetailDto> {
    return this.users.updateRole(actor, params.id, body);
  }

  @Put('users/:id/overrides')
  setOverride(
    @CurrentUser() actor: AuthUser,
    @Param(idParam) params: { id: string },
    @Body(new ZodValidationPipe(featureOverrideSchema)) body: FeatureOverrideInput,
  ): Promise<AdminUserDetailDto> {
    return this.users.setOverride(actor, params.id, body);
  }

  @Delete('users/:id/overrides/:feature')
  removeOverride(
    @CurrentUser() actor: AuthUser,
    @Param(new ZodValidationPipe(overrideFeatureParamSchema)) params: { id: string; feature: string },
  ): Promise<AdminUserDetailDto> {
    return this.users.removeOverride(actor, params.id, params.feature);
  }

  @Post('users/:id/entitlements')
  grant(
    @CurrentUser() actor: AuthUser,
    @Param(idParam) params: { id: string },
    @Body(new ZodValidationPipe(grantEntitlementSchema)) body: GrantEntitlementInput,
  ): Promise<AdminUserDetailDto> {
    return this.users.grant(actor, params.id, body);
  }

  @Get('subscriptions')
  subscriptions(
    @Query(new ZodValidationPipe(adminSubscriptionsQuerySchema)) query: AdminSubscriptionsQuery,
  ): Promise<Page<AdminSubscriptionDto>> {
    return this.billing.subscriptions(query);
  }

  @Post('subscriptions/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelSubscription(
    @CurrentUser() actor: AuthUser,
    @Param(idParam) params: { id: string },
    @Body(new ZodValidationPipe(adminCancelSubscriptionSchema)) body: AdminCancelSubscriptionInput,
  ): Promise<void> {
    return this.billing.cancelSubscription(actor, params.id, body);
  }

  @Get('payments')
  payments(@Query(new ZodValidationPipe(adminPaymentsQuerySchema)) query: AdminPaymentsQuery): Promise<Page<AdminPaymentDto>> {
    return this.billing.payments(query);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('payments/:id/refund')
  @HttpCode(HttpStatus.OK)
  refund(
    @CurrentUser() actor: AuthUser,
    @Param(idParam) params: { id: string },
    @Body(new ZodValidationPipe(refundSchema)) body: RefundInput,
  ): Promise<AdminPaymentDto> {
    return this.billing.refund(actor, params.id, body);
  }

  @Get('plans')
  plans(): Promise<AdminPlanDto[]> {
    return this.billing.plans();
  }

  @Patch('plans/:id')
  updatePlan(
    @CurrentUser() actor: AuthUser,
    @Param(idParam) params: { id: string },
    @Body(new ZodValidationPipe(updatePlanSchema)) body: UpdatePlanInput,
  ): Promise<AdminPlanDto[]> {
    return this.billing.updatePlan(actor, params.id, body);
  }

  @Get('feature-flags')
  featureFlags(): Promise<FeatureFlagDto[]> {
    return this.flags.list();
  }

  @Post('feature-flags')
  @HttpCode(HttpStatus.CREATED)
  createFlag(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(createFeatureFlagSchema)) body: CreateFeatureFlagInput,
  ): Promise<FeatureFlagDto> {
    return this.flags.create(actor.id, body);
  }

  @Patch('feature-flags/:key')
  updateFlag(
    @CurrentUser() actor: AuthUser,
    @Param(new ZodValidationPipe(flagKeyParamSchema)) params: { key: string },
    @Body(new ZodValidationPipe(updateFeatureFlagSchema)) body: UpdateFeatureFlagInput,
  ): Promise<FeatureFlagDto> {
    return this.flags.update(actor.id, params.key, body);
  }

  @Get('audit-logs')
  auditLogs(@Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery): Promise<Page<AuditLogDto>> {
    return this.audit.list(query);
  }
}
