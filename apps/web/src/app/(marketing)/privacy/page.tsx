import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Gizlilik',
  description: 'Hangi veriyi neden tutuyoruz.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Gizlilik politikası">
      <p>
        Topladığımız temel veri: email, doğum tarihi, profil alanları, yaklaşık konum, fotoğraflar, kaydırma ve mesaj
        geçmişi, ödeme durumu. Public profilde email, tam koordinat ve ödeme kimlikleri yer almaz.
      </p>
      <p>
        Veriyi eşleşme, güvenlik, faturalama ve yasal yükümlülükler için işleriz. Silme talebinde kişisel alanlar
        anonimleştirilir; mali kayıtlar saklama süresi boyunca kalır.
      </p>
    </LegalPage>
  );
}
