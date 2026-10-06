import { Global, Module } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { RealtimeService } from './realtime.service';

@Global()
@Module({
  providers: [PresenceService, RealtimeService],
  exports: [PresenceService, RealtimeService],
})
export class RealtimeModule {}
