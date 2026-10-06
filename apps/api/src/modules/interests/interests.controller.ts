import { Controller, Get } from '@nestjs/common';
import type { InterestDto } from '@dating/types';
import { Public } from '../../common/auth/decorators';
import { InterestsService } from './interests.service';

@Controller('interests')
export class InterestsController {
  constructor(private readonly interests: InterestsService) {}

  @Public()
  @Get()
  list(): Promise<InterestDto[]> {
    return this.interests.list();
  }
}
