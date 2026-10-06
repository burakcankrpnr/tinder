import { randomBytes } from 'node:crypto';
import { BullModule } from '@nestjs/bullmq';
import { Logger, Module } from '@nestjs/common';
import type { ApiEnv } from '@dating/config';
import { ENV } from '../../config/env.module';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { BillingLifecycleService } from './billing-lifecycle.service';
import { BillingController } from './billing.controller';
import { BILLING_QUEUE, BillingProcessor } from './billing.processor';
import { BillingService } from './billing.service';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentProvider } from './payment-provider';

@Module({
  imports: [BullModule.registerQueue({ name: BILLING_QUEUE })],
  controllers: [BillingController],
  providers: [
    {
      provide: PaymentProvider,
      inject: [ENV, PrismaService],
      useFactory: (env: ApiEnv, prisma: PrismaService): PaymentProvider => {
        let secret = env.PAYMENT_WEBHOOK_SECRET;
        if (!secret) {
          secret = randomBytes(32).toString('hex');
          new Logger('BillingModule').warn('PAYMENT_WEBHOOK_SECRET boş; bu süreç için rastgele üretildi');
        }
        return new MockPaymentProvider(secret, env.NEXT_PUBLIC_APP_URL, prisma);
      },
    },
    BillingService,
    BillingLifecycleService,
    BillingProcessor,
  ],
  exports: [BillingService, BillingLifecycleService, PaymentProvider],
})
export class BillingModule {}
