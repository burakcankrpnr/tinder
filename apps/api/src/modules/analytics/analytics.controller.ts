import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type AnalyticsEventInput, analyticsEventSchema } from '@dating/validation';
import type { Request } from 'express';
import { OptionalAuth, Public } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Giriş yapmamış ziyaretçiler de (SIGNUP_STARTED, PAYWALL_VIEWED) gönderebilir. */
  @Public()
  @OptionalAuth()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  async track(
    @Req() request: Request,
    @Body(new ZodValidationPipe(analyticsEventSchema)) body: AnalyticsEventInput,
  ): Promise<{ accepted: true }> {
    await this.analytics.trackClient(request.user?.id ?? null, body);
    return { accepted: true };
  }
}
