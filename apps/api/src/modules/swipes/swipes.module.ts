import { Module } from '@nestjs/common';
import { DiscoveryModule } from '../discovery/discovery.module';
import { SwipesController } from './swipes.controller';
import { SwipesService } from './swipes.service';

@Module({
  imports: [DiscoveryModule],
  controllers: [SwipesController],
  providers: [SwipesService],
  exports: [SwipesService],
})
export class SwipesModule {}
