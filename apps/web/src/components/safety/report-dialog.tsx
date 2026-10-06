'use client';

import { type ReportFormInput, type ReportInput, REPORT_REASONS, reportSchema } from '@dating/validation';
import { Alert, Button, Field, Modal, Textarea, cx } from '@dating/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { errorMessage } from '@/lib/api-client';
import { useReport } from '@/lib/communication';
import { REPORT_REASON_LABELS } from '@/lib/labels';

export function ReportDialog({
  open,
  onClose,
  reportedUserId,
  reportedName,
  messageId,
  onReported,
}: {
  open: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedName: string;
  messageId?: string;
  onReported?: (result: { blocked: boolean }) => void;
}) {
  const report = useReport();
  const [done, setDone] = useState<{ blocked: boolean } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReportFormInput, unknown, ReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: { reportedUserId, messageId, block: true, details: '' },
  });

  const close = () => {
    onClose();
    if (done) onReported?.(done);
    setDone(null);
    report.reset();
    reset({ reportedUserId, messageId, block: true, details: '' });
  };

  const onSubmit = handleSubmit(async (values) => {
    const result = await report.mutateAsync(values);
    setDone({ blocked: result.blocked });
  });

  return (
    <Modal open={open} onClose={close} title={`${reportedName} kullanıcısını şikayet et`}>
      {done ? (
        <div className="space-y-4">
          <Alert tone="success" title="Şikayetin alındı">
            Ekibimiz inceleyecek. {done.blocked ? `${reportedName} artık seninle iletişime geçemez.` : ''}
          </Alert>
          <Button fullWidth onClick={close}>
            Tamam
          </Button>
        </div>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-5">
          {report.isError && <Alert tone="danger">{errorMessage(report.error)}</Alert>}
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Neden şikayet ediyorsun?</legend>
            {REPORT_REASONS.map((reason) => (
              <label
                key={reason}
                className={cx(
                  'border-text/10 has-[:checked]:border-primary has-[:checked]:bg-primary/10 flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition',
                  'has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-2',
                )}
              >
                <input type="radio" value={reason} {...register('reason')} className="accent-primary size-4" />
                {REPORT_REASON_LABELS[reason]}
              </label>
            ))}
            {errors.reason && (
              <p role="alert" className="text-danger text-xs">
                {errors.reason.message}
              </p>
            )}
          </fieldset>
          <Field label="Açıklama" optional error={errors.details?.message}>
            <Textarea {...register('details')} maxLength={1000} placeholder="Ne oldu? Kısaca anlat." />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" {...register('block')} className="accent-primary size-4" />
            {reportedName} kullanıcısını ayrıca engelle
          </label>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={close}>
              Vazgeç
            </Button>
            <Button type="submit" variant="danger" fullWidth loading={report.isPending}>
              Şikayet et
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
