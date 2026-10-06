import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorBody, ErrorCode } from '@dating/types';

export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details?: ApiErrorBody['details'],
  ) {
    super(message, status);
  }

  static unauthorized(message = 'Kimlik doğrulaması gerekli.'): AppException {
    return new AppException('UNAUTHORIZED', message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(message = 'Bu işlem için yetkin yok.'): AppException {
    return new AppException('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }

  static notFound(message = 'Kayıt bulunamadı.'): AppException {
    return new AppException('NOT_FOUND', message, HttpStatus.NOT_FOUND);
  }

  static invalidToken(message = 'Bağlantı geçersiz veya süresi dolmuş.'): AppException {
    return new AppException('INVALID_TOKEN', message, HttpStatus.BAD_REQUEST);
  }
}
