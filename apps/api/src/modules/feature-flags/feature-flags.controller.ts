import { Controller, Get } from '@nestjs/common';
import type { FeatureFlagsDto } from '@dating/types';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { FeatureFlagsService } from './feature-flags.service';

@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  /** Yalnızca açık/kapalı bilgisi döner; rollout yüzdesi gibi iç ayarlar istemciye verilmez. */
  @Get()
  async mine(@CurrentUser() user: AuthUser): Promise<FeatureFlagsDto> {
    return { flags: await this.flags.forUser(user.id) };
  }
}
