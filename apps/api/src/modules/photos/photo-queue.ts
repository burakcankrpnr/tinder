export const PHOTO_QUEUE = 'photos';

export const PHOTO_JOBS = {
  process: 'process-photo',
  cleanup: 'cleanup-stale-uploads',
} as const;

export interface ProcessPhotoJob {
  photoId: string;
}
