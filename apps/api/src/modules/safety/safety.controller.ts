import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { BlockedUserDto, MessageDto, ReportCreatedDto } from '@dating/types';
import {
  type BlockInput,
  type ReportInput,
  blockSchema,
  reportSchema,
  userIdParamSchema,
} from '@dating/validation';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { BlocksService } from './blocks.service';
import { ReportsService } from './reports.service';

@Controller()
export class SafetyController {
  constructor(
    private readonly blocks: BlocksService,
    private readonly reports: ReportsService,
  ) {}

  @Get('blocks')
  list(@CurrentUser() user: AuthUser): Promise<BlockedUserDto[]> {
    return this.blocks.list(user.id);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('blocks')
  @HttpCode(HttpStatus.OK)
  async block(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(blockSchema)) body: BlockInput,
  ): Promise<MessageDto> {
    await this.blocks.block(user.id, body.userId);
    return { message: 'Kullanıcı engellendi.' };
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('blocks/:userId')
  async unblock(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(userIdParamSchema)) params: { userId: string },
  ): Promise<MessageDto> {
    await this.blocks.unblock(user.id, params.userId);
    return { message: 'Engel kaldırıldı.' };
  }

  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @Post('reports')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(reportSchema)) body: ReportInput,
  ): Promise<ReportCreatedDto> {
    return this.reports.create(user.id, body);
  }
}
