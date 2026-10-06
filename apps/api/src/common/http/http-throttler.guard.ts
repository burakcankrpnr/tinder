import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * WebSocket olaylarının hız limiti servis katmanında (Redis sayaçları) uygulanır.
 * Kimliği doğrulanmış isteklerde sayaç kullanıcıya göre tutulur (NAT arkasındaki kullanıcılar
 * birbirinin limitini tüketmesin); bu yüzden JwtAuthGuard'dan sonra kaydedilmelidir.
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return context.getType() !== 'http' || super.shouldSkip(context);
  }

  protected override async getTracker(req: Request): Promise<string> {
    return req.user ? `user:${req.user.id}` : `ip:${req.ip ?? 'unknown'}`;
  }
}
