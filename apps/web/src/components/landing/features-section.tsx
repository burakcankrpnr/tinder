import Link from 'next/link';
import type { ReactNode } from 'react';
import { Carousel, CarouselButtons } from './carousel';
import { AvatarScene, MoonArt, NotesArt } from './visuals';

function FeatureCard({
  tone,
  kicker,
  title,
  text,
  href,
  art,
}: {
  tone: 'romance' | 'petal' | 'plain';
  kicker: string;
  title: string;
  text: string;
  href: string;
  art: ReactNode;
}) {
  return (
    <article className={`fi-card card-${tone}`}>
      <p className="kicker">{kicker}</p>
      <h3>{title}</h3>
      <div className="art" aria-hidden="true">
        {art}
      </div>
      <p>{text}</p>
      <Link href={href}>Daha fazla bilgi al →</Link>
    </article>
  );
}

export function FeaturesSection() {
  return (
    <section className="section features" id="tinder-features">
      <div className="wrap">
        <div className="carousel-head">
          <h2>Son kaydırmandan beri çok şey değişti.</h2>
          <CarouselButtons target="features" />
        </div>
      </div>
      <div className="wrap-wide">
        <Carousel id="features" label="Tinder özellikleri">
          <FeatureCard
            tone="romance"
            kicker="Çifte Randevu"
            title="Arkadaşlarla olmak > yalnız olmak"
            text="İlk buluşmalar, arkadaşlarla birlikte daha güzel."
            href="/#double-date"
            art={<AvatarScene />}
          />
          <FeatureCard
            tone="petal"
            kicker="Astroloji Modu"
            title="Kozmik Uyum"
            text="Tüm potansiyel eşleşmeler için kozmik ipuçları."
            href="/#astrology-mode"
            art={<MoonArt />}
          />
          <FeatureCard
            tone="plain"
            kicker="Müzik Modu"
            title="Zevk sahibi olduğunu göster"
            text="En sevdiğin sanatçı, biyografinden bile daha çok şey söyler."
            href="/#music-mode"
            art={<NotesArt />}
          />
        </Carousel>
      </div>
    </section>
  );
}
