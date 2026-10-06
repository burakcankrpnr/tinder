import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Hakkımızda',
  description: 'Dating Platform neden var ve nasıl çalışıyoruz.',
};

export default function AboutPage() {
  return (
    <LegalPage title="Hakkımızda">
      <p>
        Dating Platform, konum ve tercihler üzerinden yeni insanlarla tanışmayı basit ve güvenli hale getirmek için
        tasarlandı. Hedefimiz gösterişli bir swipe uygulaması değil; gerçek kullanıcı ve ödeme trafiğini kaldıran bir
        ürün.
      </p>
      <p>
        Gizlilik varsayılandır: e-posta, tam konum ve ödeme kimlikleri public profilde yer almaz. Moderasyon ve
        raporlama ürünün bir parçasıdır, sonradan eklenmiş bir katman değil.
      </p>
    </LegalPage>
  );
}
