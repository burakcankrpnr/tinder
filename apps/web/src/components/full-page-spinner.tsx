import { Spinner } from '@dating/ui';

export function FullPageSpinner({ label = 'Sana en uygun kişiyi arıyoruz.' }: { label?: string }) {
  return (
    <div className="text-primary flex min-h-dvh items-center justify-center">
      <Spinner className="size-8" label={label} />
    </div>
  );
}
