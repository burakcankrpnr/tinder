import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { MediaHitDto } from '@dating/types';
import { type MediaSearchInput, mediaSearchSchema } from '@dating/validation';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('search')
  search(@Query(new ZodValidationPipe(mediaSearchSchema)) query: MediaSearchInput): Promise<MediaHitDto[]> {
    return this.media.search(query);
  }
}
