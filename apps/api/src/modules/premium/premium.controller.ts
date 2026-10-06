import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { BoostDto, LikesReceivedDto, PremiumSettingsDto } from '@dating/types';
import { type PremiumSettingsInput, premiumSettingsSchema } from '@dating/validation';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { PremiumService } from './premium.service';

@Controller()
export class PremiumController {
  constructor(private readonly premium: PremiumService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('boosts')
  @HttpCode(HttpStatus.CREATED)
  activateBoost(@CurrentUser() user: AuthUser): Promise<BoostDto> {
    return this.premium.activateBoost(user.id);
  }

  @Get('likes')
  likes(@CurrentUser() user: AuthUser): Promise<LikesReceivedDto> {
    return this.premium.likesReceived(user.id);
  }

  @Get('profile/me/premium-settings')
  settings(@CurrentUser() user: AuthUser): Promise<PremiumSettingsDto> {
    return this.premium.settings(user.id);
  }

  @Put('profile/me/premium-settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(premiumSettingsSchema)) body: PremiumSettingsInput,
  ): Promise<PremiumSettingsDto> {
    return this.premium.updateSettings(user.id, body);
  }
}
