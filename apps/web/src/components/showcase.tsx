'use client';

import { buttonClasses } from '@dating/ui';
import { useEffect, useRef } from 'react';

const STEPS = [
  { title: 'Profilini oluştur', text: 'Fotoğrafını, ilgi alanlarını ve ne aradığını bir kez anlat.' },
  { title: 'Kaydır', text: 'Yakınındaki kişilerle tanış. Beğen, geç ya da öne çıkar.' },
  { title: 'Eşleş ve yaz', text: 'Karşılıklı beğeni eşleşmedir. Sohbet uygulamada başlar.' },
];

const FRAMES = [
  { label: 'Keşfet', title: 'Ayşe, 27', text: '2 km · kahve ve yürüyüş' },
  { label: 'Eşleşme', title: 'Yeni eşleşme', text: 'İkiniz de birbirinizi beğendiniz.' },
  { label: 'Sohbet', title: 'Merhaba', text: 'Bu akşam müsait misin?' },
];

const PLANS = [
  { name: 'Free', price: 'Ücretsiz', text: 'Günlük beğeni ve eşleşme.' },
  { name: 'Plus', price: 'Uygulamada', text: 'Seni beğenenleri gör, daha fazla super like.' },
  { name: 'Premium', price: 'Uygulamada', text: 'Öncelikli görünürlük, geri al ve pasaport.' },
];

export function Showcase() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let revert: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const context = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
          gsap.from(element, {
            autoAlpha: 0,
            y: 48,
            duration: 0.8,
            scrollTrigger: { trigger: element, start: 'top 82%' },
          });
        });

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: '[data-pin]',
            start: 'top top',
            end: '+=180%',
            pin: true,
            scrub: true,
          },
        });
        FRAMES.forEach((_, index) => {
          if (index === 0) return;
          timeline
            .to(`[data-frame="${index - 1}"]`, { autoAlpha: 0, duration: 0.35 })
            .to(`[data-frame="${index}"]`, { autoAlpha: 1, duration: 0.35 }, '<');
        });
      }, node);
      revert = () => context.revert();
    })();

    return () => {
      cancelled = true;
      revert?.();
    };
  }, []);

  return (
    <div ref={root}>
      <header className="border-text/5 mx-auto flex h-16 max-w-5xl items-center px-4">
        <a href="#baslangic" className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="bg-accent-gradient size-7 rounded-xl" />
          Dating
        </a>
        <nav aria-label="Site menüsü" className="text-text-muted ml-auto flex gap-4 text-sm">
          <a href="#nasil" className="hover:text-text">
            Nasıl çalışır
          </a>
          <a href="#paketler" className="hover:text-text">
            Paketler
          </a>
          <a href="/safety" className="hover:text-text">
            Güvenlik
          </a>
        </nav>
      </header>

      <section id="baslangic" className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center gap-6 px-4 text-center">
        <p data-reveal className="text-primary text-sm font-semibold tracking-wide">
          Mobil dating uygulaması
        </p>
        <h1 data-reveal className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Tanışma, kaydırma ve sohbet uygulamada.
        </h1>
        <p data-reveal className="text-text-muted text-lg">
          Bu site ürünü anlatır. Hesap açmak, kaydırmak ve yazışmak için uygulamayı indir.
        </p>
        <a href="#indir" className={buttonClasses({ size: 'lg' })}>
          Mağazalara git
        </a>
      </section>

      <section id="nasil" className="mx-auto grid max-w-5xl gap-4 px-4 py-24 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <article key={step.title} data-reveal className="bg-surface/80 rounded-card border-text/5 border p-5">
            <p className="text-primary mb-2 text-sm font-semibold">0{index + 1}</p>
            <h2 className="font-semibold">{step.title}</h2>
            <p className="text-text-muted mt-1 text-sm">{step.text}</p>
          </article>
        ))}
      </section>

      <section data-pin className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center gap-8 px-4 sm:flex-row">
        <div data-reveal className="max-w-md space-y-3">
          <h2 className="text-3xl font-semibold">Uygulamanın içi</h2>
          <p className="text-text-muted">Keşfet, eşleş ve sohbet et. Kayıt bu sitede yok; her şey telefonda.</p>
        </div>
        <div className="bg-surface relative h-[28rem] w-72 overflow-hidden rounded-[2rem] border border-text/10 p-4">
          {FRAMES.map((frame, index) => (
            <div
              key={frame.label}
              data-frame={index}
              className="absolute inset-4 flex flex-col justify-end rounded-card bg-app-gradient p-5"
              style={{ opacity: index === 0 ? 1 : 0 }}
            >
              <p className="text-primary-soft text-xs font-semibold">{frame.label}</p>
              <p className="mt-2 text-2xl font-semibold">{frame.title}</p>
              <p className="text-text-muted mt-1 text-sm">{frame.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="paketler" className="mx-auto grid max-w-5xl gap-4 px-4 py-24 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <article key={plan.name} data-reveal className="bg-surface rounded-card border-text/10 border p-5">
            <h2 className="text-lg font-semibold">{plan.name}</h2>
            <p className="text-primary mt-2 font-semibold">{plan.price}</p>
            <p className="text-text-muted mt-2 text-sm">{plan.text}</p>
          </article>
        ))}
      </section>

      <section id="indir" className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h2 data-reveal className="text-3xl font-semibold">
          İndir ve tanışmaya başla
        </h2>
        <p data-reveal className="text-text-muted">
          Mağaza bağlantıları yayınlandığında burada olacak. Şimdilik yer tutucu.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" className={buttonClasses({ size: 'lg' })} disabled>
            App Store
          </button>
          <button type="button" className={buttonClasses({ variant: 'secondary', size: 'lg' })} disabled>
            Google Play
          </button>
        </div>
      </section>

      <footer className="border-text/5 border-t">
        <nav aria-label="Alt menü" className="text-text-muted mx-auto flex max-w-5xl flex-wrap gap-x-5 gap-y-2 px-4 py-6 text-sm">
          <a href="/about" className="hover:text-text">
            Hakkımızda
          </a>
          <a href="/safety" className="hover:text-text">
            Güvenlik
          </a>
          <a href="/community-guidelines" className="hover:text-text">
            Topluluk kuralları
          </a>
          <a href="/terms" className="hover:text-text">
            Kullanım şartları
          </a>
          <a href="/privacy" className="hover:text-text">
            Gizlilik
          </a>
          <a href="/contact" className="hover:text-text">
            İletişim
          </a>
        </nav>
      </footer>
    </div>
  );
}
