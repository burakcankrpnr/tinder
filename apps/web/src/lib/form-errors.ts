import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, errorMessage } from './api-client';

/**
 * API'nin VALIDATION_ERROR detaylarını ilgili form alanlarına dağıtır.
 * Alanla eşleşmeyen hatalar için genel mesajı döndürür (yoksa null).
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: ReadonlyArray<Path<T>>,
): string | null {
  if (error instanceof ApiError && error.code === 'VALIDATION_ERROR' && error.details?.length) {
    let unmatched = false;
    for (const detail of error.details) {
      const field = fields.find((name) => detail.path === name || detail.path.startsWith(`${name}.`));
      if (field) setError(field, { type: 'server', message: detail.message });
      else unmatched = true;
    }
    return unmatched ? error.message : null;
  }
  return errorMessage(error);
}
