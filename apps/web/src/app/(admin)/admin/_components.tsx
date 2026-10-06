'use client';

import { Alert, Button, Spinner } from '@dating/ui';
import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/api-client';

export function AdminLoad({
  pending,
  error,
  children,
}: {
  pending: boolean;
  error: unknown;
  children: ReactNode;
}) {
  if (pending) {
    return (
      <div className="text-primary flex justify-center py-16">
        <Spinner className="size-8" label="Yükleniyor" />
      </div>
    );
  }
  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  return <>{children}</>;
}

export function LoadMore({
  hasNext,
  loading,
  onClick,
}: {
  hasNext: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  if (!hasNext) return null;
  return (
    <div className="flex justify-center pt-4">
      <Button variant="secondary" loading={loading} onClick={onClick}>
        Daha fazla
      </Button>
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}
