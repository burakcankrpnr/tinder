import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'İletişim',
  description: 'Destek ve güvenlik bildirimleri.',
};

export default function ContactPage() {
  return (
    <LegalPage title="İletişim">
      <p>
        Destek için <a className="text-primary underline" href="mailto:support@example.com">support@example.com</a>{' '}
        adresine yaz. Güvenlik açığı bildirimi için aynı kanalı kullan; raporu gizli tutarız.
      </p>
      <p>Hesap sorunlarında kayıtlı emailini ve mümkünse istek kimliğini (request id) ekle.</p>
    </LegalPage>
  );
}
