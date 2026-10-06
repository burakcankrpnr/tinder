import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Topluluk kuralları',
  description: 'Platformda kabul edilen davranışlar.',
};

export default function CommunityGuidelinesPage() {
  return (
    <LegalPage title="Topluluk kuralları">
      <p>18 yaşından küçüklere yer yok. Sahte profil, taciz, dolandırıcılık ve spam yasaktır.</p>
      <p>Fotoğrafların sana ait olmalı. Cinsel içerik, şiddet ve nefret söylemi kabul edilmez.</p>
      <p>Kuralları ihlal eden hesaplar uyarılır, kısıtlanır veya kalıcı olarak kapatılır.</p>
    </LegalPage>
  );
}
