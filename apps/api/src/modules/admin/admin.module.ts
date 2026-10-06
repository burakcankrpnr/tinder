import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { PhotosModule } from '../photos/photos.module';
import { VerificationModule } from '../verification/verification.module';
import { AdminAuditService } from './admin-audit.service';
import { AdminBillingService } from './admin-billing.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminModerationService } from './admin-moderation.service';
import { AdminUsersService } from './admin-users.service';
import { AdminController, AdminModerationController } from './admin.controller';

@Module({
  imports: [AuthModule, BillingModule, PhotosModule, VerificationModule],
  controllers: [AdminModerationController, AdminController],
  providers: [AdminUsersService, AdminModerationService, AdminBillingService, AdminDashboardService, AdminAuditService],
})
export class AdminModule {}
