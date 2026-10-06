import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  MessageDto,
  NotificationPageDto,
  NotificationPreferencesDto,
  PushConfigDto,
} from '@dating/types';
import {
  type MarkNotificationsReadInput,
  type NotificationPreferencesInput,
  type NotificationsQueryInput,
  type PushSubscriptionInput,
  markNotificationsReadSchema,
  notificationPreferencesSchema,
  notificationsQuerySchema,
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
} from '@dating/validation';
import type { Request } from 'express';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(notificationsQuerySchema)) query: NotificationsQueryInput,
  ): Promise<NotificationPageDto> {
    return this.notifications.list(user.id, query);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser): Promise<{ unreadCount: number }> {
    return { unreadCount: await this.notifications.unreadCount(user.id) };
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(markNotificationsReadSchema)) body: MarkNotificationsReadInput,
  ): Promise<{ unreadCount: number }> {
    return { unreadCount: await this.notifications.markRead(user.id, body) };
  }

  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser): Promise<NotificationPreferencesDto> {
    return this.notifications.preferences(user.id);
  }

  @Put('preferences')
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(notificationPreferencesSchema)) body: NotificationPreferencesInput,
  ): Promise<NotificationPreferencesDto> {
    return this.notifications.updatePreferences(user.id, body);
  }

  @Get('push/config')
  pushConfig(): PushConfigDto {
    return this.push.config();
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('push/subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(pushSubscriptionSchema)) body: PushSubscriptionInput,
    @Req() request: Request,
  ): Promise<MessageDto> {
    const userAgent = request.headers['user-agent']?.slice(0, 300) ?? null;
    await this.push.subscribe(user.id, body, userAgent);
    return { message: 'Bildirimler açıldı.' };
  }

  @Post('push/unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(pushUnsubscribeSchema)) body: { endpoint: string },
  ): Promise<MessageDto> {
    await this.push.unsubscribe(user.id, body.endpoint);
    return { message: 'Bildirimler kapatıldı.' };
  }
}
