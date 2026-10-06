import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { MessageDto, PhotoDto, PhotoUploadDto } from '@dating/types';
import {
  MAX_VIDEO_BYTES,
  type PhotoOrderInput,
  type PhotoUploadRequestInput,
  idParamSchema,
  photoOrderSchema,
  photoUploadRequestSchema,
} from '@dating/validation';
import type { Request } from 'express';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser, Public } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { PhotosService } from './photos.service';

@Controller('photos')
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<PhotoDto[]> {
    return this.photos.list(user.id);
  }

  @Public()
  @Get('media/*path')
  async media(@Req() request: Request): Promise<StreamableFile> {
    const marker = '/photos/media/';
    const source = request.originalUrl.split('?')[0] ?? '';
    const index = source.indexOf(marker);
    let key = '';
    if (index >= 0) {
      try {
        key = decodeURIComponent(source.slice(index + marker.length));
      } catch {
        key = '';
      }
    }
    const file = await this.photos.readPublicMedia(key);
    return new StreamableFile(file.body, {
      type: file.contentType ?? 'application/octet-stream',
      length: file.body.length,
    });
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('upload-url')
  createUpload(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(photoUploadRequestSchema)) body: PhotoUploadRequestInput,
  ): Promise<PhotoUploadDto> {
    return this.photos.createUpload(user.id, body);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/content')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_VIDEO_BYTES } }))
  store(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
    @UploadedFile() file: unknown,
  ): Promise<MessageDto> {
    return this.photos.storeUpload(user.id, params.id, file);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
  ): Promise<PhotoDto> {
    return this.photos.completeUpload(user.id, params.id);
  }

  @Put('order')
  reorder(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(photoOrderSchema)) body: PhotoOrderInput,
  ): Promise<PhotoDto[]> {
    return this.photos.reorder(user.id, body.ids);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
  ): Promise<MessageDto> {
    await this.photos.remove(user.id, params.id);
    return { message: 'Fotoğraf silindi.' };
  }
}
