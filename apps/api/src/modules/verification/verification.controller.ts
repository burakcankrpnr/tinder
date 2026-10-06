import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { VerificationStateDto, VerificationUploadDto } from '@dating/types';
import { type PhotoUploadRequestInput, idParamSchema, photoUploadRequestSchema } from '@dating/validation';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { VerificationService } from './verification.service';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get()
  state(@CurrentUser() user: AuthUser): Promise<VerificationStateDto> {
    return this.verification.state(user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  start(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(photoUploadRequestSchema)) body: PhotoUploadRequestInput,
  ): Promise<VerificationUploadDto> {
    return this.verification.start(user.id, body);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
  ): Promise<VerificationStateDto> {
    return this.verification.submit(user.id, params.id);
  }
}
