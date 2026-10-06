import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Güvenlik',
  description: 'Engelleme, raporlama ve hesap güvenliği.',
};

export default function SafetyPage() {
  return (
    <LegalPage title="Güvenlik">
      <p>Rahatsız edici bir profili engelleyebilir veya raporlayabilirsin. Engellenen kişi seninle eşleşemez ve yazamaz.</p>
      <p>Fotoğraflar yüklenirken EXIF konum bilgisi silinir; konumun yaklaşık 1 km hassasiyetle saklanır.</p>
      <p>Şüpheli hesaplar kısıtlanabilir veya yasaklanabilir. Acil bir durumda yerel acil hatları kullan.</p>
    </LegalPage>
  );
}
