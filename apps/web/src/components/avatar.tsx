import type { PhotoUrlsDto } from '@dating/types';
import { cx } from '@dating/ui';

export function Avatar({
  photo,
  name,
  online,
  size = 'md',
}: {
  photo: PhotoUrlsDto | null;
  name: string;
  online?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'size-20' : size === 'sm' ? 'size-10' : 'size-14';
  return (
    <span className={cx('relative inline-block shrink-0', sizeClass)}>
      {photo ? (
        <img src={photo.thumb} alt="" className="size-full rounded-full object-cover" loading="lazy" />
      ) : (
        <span className="bg-surface-2 text-text-muted flex size-full items-center justify-center rounded-full text-lg font-semibold">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {online && (
        <span className="bg-success border-bg-bottom absolute bottom-0 right-0 size-3.5 rounded-full border-2">
          <span className="sr-only">Çevrimiçi</span>
        </span>
      )}
    </span>
  );
}
