import type { PhotoDto, PhotoUploadDto } from '@dating/types';
import { MAX_PHOTO_BYTES, PHOTO_CONTENT_TYPES } from '@dating/validation';
import { ApiError, api } from './api-client';

export const ACCEPTED_PHOTO_TYPES = PHOTO_CONTENT_TYPES.join(',');

export function validatePhotoFile(file: File): string | null {
  if (!(PHOTO_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return 'Yalnızca JPEG, PNG veya WebP yükleyebilirsin.';
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `Fotoğraf en fazla ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} MB olabilir.`;
  }
  return null;
}

export function postToStorage(
  upload: PhotoUploadDto['upload'],
  file: File,
  onProgress: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', upload.url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError('BAD_REQUEST', 'Fotoğraf yüklenemedi.', xhr.status));
    xhr.onerror = () => reject(new ApiError('NETWORK_ERROR', 'Fotoğraf yüklenemedi. Bağlantını kontrol et.', 0));
    xhr.send(form);
  });
}

/** upload-url -> depolamaya doğrudan POST -> complete (işleme kuyruğa alınır). */
export async function uploadPhoto(file: File, onProgress: (ratio: number) => void): Promise<PhotoDto> {
  const { photo, upload } = await api<PhotoUploadDto>('/photos/upload-url', {
    method: 'POST',
    body: { contentType: file.type, size: file.size },
  });
  await postToStorage(upload, file, onProgress);
  return api<PhotoDto>(`/photos/${photo.id}/complete`, { method: 'POST' });
}
