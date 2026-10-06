import { Controller, Delete, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { MatchDetailDto, MatchListDto, MessageDto } from '@dating/types';
import { matchIdParamSchema } from '@dating/validation';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<MatchListDto> {
    return this.matches.list(user.id);
  }

  @Get(':matchId')
  detail(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(matchIdParamSchema)) params: { matchId: string },
  ): Promise<MatchDetailDto> {
    return this.matches.detail(params.matchId, user.id);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Delete(':matchId')
  async unmatch(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(matchIdParamSchema)) params: { matchId: string },
  ): Promise<MessageDto> {
    await this.matches.unmatch(params.matchId, user.id);
    return { message: 'Eşleşme kaldırıldı.' };
  }
}
