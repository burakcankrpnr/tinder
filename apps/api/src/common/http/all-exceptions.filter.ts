import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ApiErrorBody, ApiFailure, ErrorCode } from '@dating/types';
import type { Request, Response } from 'express';
import { AppException } from './app.exception';

function isFileTooLarge(exception: unknown): boolean {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'code' in exception &&
    (exception as { code: unknown }).code === 'LIMIT_FILE_SIZE'
  );
}

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.error({ err: exception, type: host.getType() }, 'Unhandled non-HTTP exception');
      return;
    }
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = typeof request.id === 'string' ? request.id : undefined;

    const { status, error } = this.toError(exception);
    if (status >= 500) {
      this.logger.error(
        { err: exception, requestId, path: request.path },
        'Unhandled exception',
      );
    }

    const body: ApiFailure = { success: false, error: { ...error, requestId } };
    response.status(status).json(body);
  }

  private toError(exception: unknown): { status: number; error: ApiErrorBody } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.details ? { details: exception.details } : {}),
        },
      };
    }

    if (isFileTooLarge(exception)) {
      return {
        status: HttpStatus.BAD_REQUEST,
        error: { code: 'BAD_REQUEST', message: 'Bu dosya çok büyük.' },
      };
    }

    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        error: { code: 'RATE_LIMITED', message: 'Çok fazla istek. Lütfen biraz bekle.' },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        error: {
          code: STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
          message: status >= 500 ? 'Beklenmeyen bir hata oluştu.' : exception.message,
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: { code: 'INTERNAL_ERROR', message: 'Beklenmeyen bir hata oluştu.' },
    };
  }
}
