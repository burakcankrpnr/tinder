import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { RewindResultDto, SwipeResultDto } from '@dating/types';
import { type SwipeInput, swipeSchema } from '@dating/validation';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { SwipesService } from './swipes.service';

@Controller('swipes')
export class SwipesController {
  constructor(private readonly swipes: SwipesService) {}

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  swipe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(swipeSchema)) body: SwipeInput,
  ): Promise<SwipeResultDto> {
    return this.swipes.swipe(user.id, body);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('rewind')
  @HttpCode(HttpStatus.OK)
  rewind(@CurrentUser() user: AuthUser): Promise<RewindResultDto> {
    return this.swipes.rewind(user.id);
  }
}
