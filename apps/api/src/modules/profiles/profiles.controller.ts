import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { MyProfileDto, PublicProfileDto, UsernameAvailabilityDto } from '@dating/types';
import {
  type InterestsInput,
  type LocationInput,
  type PreferencesInput,
  type ProfileBasicsInput,
  interestsSchema,
  locationSchema,
  preferencesSchema,
  profileBasicsSchema,
  usernameParamSchema,
  usernameQuerySchema,
} from '@dating/validation';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { ProfilesService } from './profiles.service';

@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('profile/me')
  me(@CurrentUser() user: AuthUser): Promise<MyProfileDto> {
    return this.profiles.getMe(user.id);
  }

  @Put('profile/me')
  updateBasics(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(profileBasicsSchema)) body: ProfileBasicsInput,
  ): Promise<MyProfileDto> {
    return this.profiles.updateBasics(user.id, body);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('profile/username-available')
  async usernameAvailable(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(usernameQuerySchema)) query: { username: string },
  ): Promise<UsernameAvailabilityDto> {
    return { available: await this.profiles.isUsernameAvailable(user.id, query.username) };
  }

  @Put('profile/me/preferences')
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(preferencesSchema)) body: PreferencesInput,
  ): Promise<MyProfileDto> {
    return this.profiles.updatePreferences(user.id, body);
  }

  @Put('profile/me/interests')
  updateInterests(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(interestsSchema)) body: InterestsInput,
  ): Promise<MyProfileDto> {
    return this.profiles.updateInterests(user.id, body);
  }

  @Put('profile/me/location')
  updateLocation(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(locationSchema)) body: LocationInput,
  ): Promise<MyProfileDto> {
    return this.profiles.updateLocation(user.id, body);
  }

  @Post('profile/me/complete-onboarding')
  @HttpCode(HttpStatus.OK)
  completeOnboarding(@CurrentUser() user: AuthUser): Promise<MyProfileDto> {
    return this.profiles.completeOnboarding(user.id);
  }

  @Get('profiles/:username')
  publicProfile(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(usernameParamSchema)) params: { username: string },
  ): Promise<PublicProfileDto> {
    return this.profiles.getPublic(user.id, params.username);
  }
}
