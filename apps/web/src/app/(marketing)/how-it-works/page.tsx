import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Nasıl çalışır',
  description: 'Kayıt, keşif, eşleşme ve sohbet adımları.',
};

export default function HowItWorksPage() {
  return (
    <LegalPage title="Nasıl çalışır">
      <p>1. Email ile kayıt ol, hesabını doğrula ve 18 yaşını onayla.</p>
      <p>2. Profilini, fotoğraflarını, tercihlerini ve konumunu tamamla.</p>
      <p>3. Keşfet ekranında kartları kaydır: sağ beğeni, sol geçiş.</p>
      <p>4. Karşılıklı beğeni eşleşmedir. Sohbet yalnızca eşleşmeler arasında açılır.</p>
      <p>5. İstersen Plus veya Premium ile limitleri ve görünürlüğü artır.</p>
    </LegalPage>
  );
}
