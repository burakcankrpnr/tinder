import Link from 'next/link';
import { FlameIcon } from './icons';
import { LanguagePicker } from './language-picker';

const COLUMNS = [
  {
    label: 'Sosyal Medya',
    links: [
      { href: 'https://www.instagram.com/tinder', label: 'Instagram', external: true },
      { href: 'https://www.tiktok.com/@tinder', label: 'TikTok', external: true },
      { href: 'https://www.youtube.com/Tinder', label: 'YouTube', external: true },
      { href: 'https://twitter.com/Tinder', label: 'X', external: true },
      { href: 'https://www.facebook.com/tinder', label: 'Facebook', external: true },
    ],
  },
  {
    label: 'Yasal',
    links: [
      { href: '/privacy', label: 'Gizlilik', external: false },
      { href: '/terms', label: 'Koşullar', external: false },
      { href: '/privacy', label: 'Çerez Politikası', external: false },
      { href: '/community-guidelines', label: 'Topluluk Kuralları', external: false },
      { href: '/safety', label: 'Erişilebilirlik Beyanı', external: false },
    ],
  },
  {
    label: 'Kariyer',
    links: [
      { href: '/about', label: 'Kariyer Portalı', external: false },
      { href: '/about', label: 'Teknoloji Blogu', external: false },
    ],
  },
  {
    label: 'Şirket',
    links: [
      { href: '/#destek', label: 'SSS', external: false },
      { href: '/how-it-works', label: 'Kaydırma Hikayeleri', external: false },
      { href: '/contact', label: 'Bize Ulaşın', external: false },
      { href: '/#hediye', label: 'Hediye Kartları', external: false },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="brand-row">
            <FlameIcon />
            <p>© 2026 Tinder LLC</p>
          </div>
          <p>
            Belki ciddi bir ilişki, belki bir kaçamak, belki de ismini henüz koyamadığın bir şey. Aradığın ne olursa
            olsun, gerçek bağlantılar kurmak için Tinder doğru adres. 190 ülkede kullanılabilen ve 55 milyardan fazla
            eşleşme sağlayan Tinder, dünyanın en popüler flört uygulaması.
          </p>
          <LanguagePicker anchor="footer" variant="footer" />
        </div>
        <div className="cols">
          {COLUMNS.map((column) => (
            <nav key={column.label} aria-label={column.label}>
              <h3>{column.label}</h3>
              <ul>
                {column.links.map((link) => (
                  <li key={`${column.label}-${link.label}`}>
                    {link.external ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href}>{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="footer-wordmark" aria-hidden="true">
        tinder
      </div>
    </footer>
  );
}
