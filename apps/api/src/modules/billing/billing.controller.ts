import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, type RawBodyRequest, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CatalogDto, CheckoutDto, EntitlementsDto, MockCheckoutDto, PaymentDto } from '@dating/types';
import {
  type CheckoutInput,
  checkoutIdParamSchema,
  checkoutSchema,
  idempotencyKeySchema,
  mockCheckoutOutcomeSchema,
  mockSimulationSchema,
  providerParamSchema,
} from '@dating/validation';
import type { Request } from 'express';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser, Public } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { BillingLifecycleService, type WebhookResult } from './billing-lifecycle.service';
import { BillingService } from './billing.service';
import { CatalogService } from './catalog.service';
import { EntitlementsService } from './entitlements.service';

@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly lifecycle: BillingLifecycleService,
    private readonly catalog: CatalogService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** Paywall ve /pricing için; fiyatlar her zaman backend'den gelir. */
  @Public()
  @Get('billing/plans')
  plans(): Promise<CatalogDto> {
    return this.catalog.catalog();
  }

  @Get('billing/entitlements')
  myEntitlements(@CurrentUser() user: AuthUser): Promise<EntitlementsDto> {
    return this.entitlements.summary(user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('billing/subscription/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthUser): Promise<EntitlementsDto> {
    return this.billing.cancel(user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('payments/checkout')
  @HttpCode(HttpStatus.CREATED)
  checkout(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(checkoutSchema)) body: CheckoutInput,
  ): Promise<CheckoutDto> {
    const key = new ZodValidationPipe(idempotencyKeySchema).transform(idempotencyKey);
    return this.billing.checkout(user.id, body, key);
  }

  @Get('payments')
  payments(@CurrentUser() user: AuthUser): Promise<PaymentDto[]> {
    return this.billing.payments(user.id);
  }

  /** Provider → backend. İmza ham gövde üzerinden doğrulanır; aynı event tekrar gelirse yok sayılır. */
  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Post('payments/webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Param(new ZodValidationPipe(providerParamSchema)) params: { provider: string },
    @Req() req: RawBodyRequest<Request>,
  ): Promise<WebhookResult> {
    return this.lifecycle.receive(params.provider, req.rawBody, req.headers);
  }

  @Get('payments/mock/checkouts/:checkoutId')
  mockCheckout(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(checkoutIdParamSchema)) params: { checkoutId: string },
  ): Promise<MockCheckoutDto> {
    return this.billing.mockCheckout(user.id, params.checkoutId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('payments/mock/checkouts/:checkoutId/complete')
  @HttpCode(HttpStatus.OK)
  completeMockCheckout(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(checkoutIdParamSchema)) params: { checkoutId: string },
    @Body(new ZodValidationPipe(mockCheckoutOutcomeSchema)) body: { outcome: 'success' | 'fail' | 'cancel' },
  ): Promise<MockCheckoutDto> {
    return this.billing.completeMockCheckout(user.id, params.checkoutId, body.outcome);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('payments/mock/subscription/simulate')
  @HttpCode(HttpStatus.OK)
  simulate(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(mockSimulationSchema)) body: { event: 'renew' | 'payment_failed' | 'expire' },
  ): Promise<EntitlementsDto> {
    return this.billing.simulate(user.id, body.event);
  }
}
