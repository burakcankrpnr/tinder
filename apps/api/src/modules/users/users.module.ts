import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { PhotosModule } from '../photos/photos.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, PhotosModule, BillingModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
