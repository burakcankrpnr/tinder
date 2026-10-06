import { Global, Module } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { ReportsService } from './reports.service';
import { SafetyController } from './safety.controller';

@Global()
@Module({
  controllers: [SafetyController],
  providers: [BlocksService, ReportsService],
  exports: [BlocksService, ReportsService],
})
export class SafetyModule {}
