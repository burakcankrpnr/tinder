import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { DiscoveryFeedDto } from '@dating/types';
import { type DiscoveryQueryInput, discoveryQuerySchema } from '@dating/validation';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { DiscoveryService } from './discovery.service';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get()
  feed(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(discoveryQuerySchema)) query: DiscoveryQueryInput,
  ): Promise<DiscoveryFeedDto> {
    return this.discovery.feed(user.id, query);
  }
}
