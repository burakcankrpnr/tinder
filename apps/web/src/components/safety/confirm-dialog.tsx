'use client';

import { Alert, Button, Modal } from '@dating/ui';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  loading,
  error,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        <p className="text-text-muted text-sm">{description}</p>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="danger" fullWidth loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
