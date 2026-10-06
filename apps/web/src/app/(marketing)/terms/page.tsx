import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Kullanım şartları',
  description: 'Hizmetin kullanım koşulları.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Kullanım şartları">
      <p>Hizmeti kullanarak 18 yaşında olduğunu, doğru bilgi verdiğini ve topluluk kurallarına uyacağını kabul edersin.</p>
      <p>Abonelikler dönem sonunda yenilenir; iptal dönem sonuna kadar erişimi kapatmaz. Ödemeler doğrulanmış webhook ile işlenir.</p>
      <p>Hesabını Ayarlar’dan silebilirsin. Yasal saklama gereken ödeme kayıtları anonimleştirilerek tutulabilir.</p>
    </LegalPage>
  );
}
