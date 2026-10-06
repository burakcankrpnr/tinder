import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { ApiSuccess } from '@dating/types';
import type { Request } from 'express';
import { type Observable, map } from 'rxjs';

/** Yalnızca HTTP yanıtlarını sarar; WebSocket ack'leri gateway'de zaten ApiResponse olarak döner. */
@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T | null> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T | null> | T> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<Request>();
    if (request.path.includes('/photos/media/')) return next.handle();
    return next.handle().pipe(map((data) => ({ success: true, data: data ?? null })));
  }
}
