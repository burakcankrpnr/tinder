import { OpenAuthButton } from './landing-ui';

const TIERS = [
  {
    kicker: 'Plus',
    title: 'Sınırsız kaydır',
    featured: false,
    cta: 'Plus ile başla',
    tone: 'btn btn-secondary',
    items: ['Sınırsız beğeni', 'Geri alma', 'Passport ile başka şehir', 'Reklamsız gezinme'],
  },
  {
    kicker: 'Gold',
    title: 'Seni kim beğendi',
    featured: true,
    cta: "Gold'a geç",
    tone: 'btn btn-primary',
    items: ['Beğenileri anında gör', 'Ayda ücretsiz Boost', 'Haftalık Super Like', 'Plus özelliklerinin tümü'],
  },
  {
    kicker: 'Platinum',
    title: 'Önce senin mesajın',
    featured: false,
    cta: "Platinum'u gör",
    tone: 'btn btn-secondary',
    items: ['Eşleşmeden mesaj', 'Öncelikli beğeniler', 'Daha uzun Boost', 'Gold özelliklerinin tümü'],
  },
] as const;

export function SubscriptionsSection() {
  return (
    <section className="extra" id="abonelikler">
      <div className="wrap">
        <h2 className="block-title">Abonelikler</h2>
        <p>Kaydırma ücretsiz. Biraz daha öne çıkmak istediğinde kademeler devreye girer.</p>
        <div className="tiers">
          {TIERS.map((tier) => (
            <article className={tier.featured ? 'tier featured' : 'tier'} key={tier.kicker}>
              <p className="kicker">{tier.kicker}</p>
              <h3>{tier.title}</h3>
              <ul>
                {tier.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <OpenAuthButton mode="signup" className={tier.tone}>
                {tier.cta}
              </OpenAuthButton>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
