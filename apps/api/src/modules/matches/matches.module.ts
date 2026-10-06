import { Module } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesRealtimeListener } from './matches.listener';
import { MatchesService } from './matches.service';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, MatchesRealtimeListener],
  exports: [MatchesService],
})
export class MatchesModule {}
