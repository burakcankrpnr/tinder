import { Global, Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { EntitlementsService } from './entitlements.service';

/** Discovery/swipe gibi modüller premium kontrolünü bu merkezi servis üzerinden yapar. */
@Global()
@Module({
  providers: [CatalogService, EntitlementsService],
  exports: [CatalogService, EntitlementsService],
})
export class EntitlementsModule {}
