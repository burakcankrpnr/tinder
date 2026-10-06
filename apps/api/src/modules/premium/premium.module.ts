import { Module } from '@nestjs/common';
import { DiscoveryModule } from '../discovery/discovery.module';
import { PremiumController } from './premium.controller';
import { PremiumService } from './premium.service';

@Module({
  imports: [DiscoveryModule],
  controllers: [PremiumController],
  providers: [PremiumService],
})
export class PremiumModule {}
