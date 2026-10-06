import { Global, Module } from '@nestjs/common';
import { AnalyticsKpiService } from './analytics-kpi.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsListener } from './analytics.listener';
import { AnalyticsService } from './analytics.service';

@Global()
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsListener, AnalyticsKpiService],
  exports: [AnalyticsService, AnalyticsKpiService],
})
export class AnalyticsModule {}
