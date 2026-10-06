'use client';

import { Button } from '@dating/ui';
import { useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { useBlockUser } from '@/lib/communication';
import { ConfirmDialog } from './confirm-dialog';
import { ReportDialog } from './report-dialog';

/** Profil görünümlerinde "Şikayet et" ve "Engelle" aksiyonları. */
export function SafetyActions({
  userId,
  name,
  onDone,
}: {
  userId: string;
  name: string;
  /** Kullanıcı engellendiğinde veya şikayet+engel yapıldığında çağrılır. */
  onDone?: () => void;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const block = useBlockUser();

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
        Şikayet et
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setBlockOpen(true)}>
        Engelle
      </Button>
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        reportedUserId={userId}
        reportedName={name}
        onReported={({ blocked }) => {
          if (blocked) onDone?.();
        }}
      />
      <ConfirmDialog
        open={blockOpen}
        title={`${name} engellensin mi?`}
        description="Engellediğin kişi seni keşfette göremez, sana mesaj gönderemez ve varsa eşleşmeniz sona erer. Engeli ayarlardan kaldırabilirsin."
        confirmLabel="Engelle"
        loading={block.isPending}
        error={block.isError ? errorMessage(block.error) : null}
        onClose={() => {
          setBlockOpen(false);
          block.reset();
        }}
        onConfirm={() =>
          block.mutate(userId, {
            onSuccess: () => {
              setBlockOpen(false);
              onDone?.();
            },
          })
        }
      />
    </div>
  );
}
