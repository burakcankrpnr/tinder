import { HttpStatus, Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppException } from './app.exception';

@Injectable()
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<TSchema>
> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Gönderilen veriler geçersiz.',
        HttpStatus.UNPROCESSABLE_ENTITY,
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }
    return result.data;
  }
}
