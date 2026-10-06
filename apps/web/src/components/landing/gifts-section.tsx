const GIFTS = [
  { term: '1 ay', name: 'Gold', text: 'Bir ay boyunca seni beğenenleri görsün.', tone: '' },
  { term: '3 ay', name: 'Platinum', text: 'Öncelikli beğeniler ve önce mesaj.', tone: 'gift-platinum' },
  { term: '6 ay', name: 'Plus', text: 'Sınırsız kaydırma, uzun soluklu.', tone: 'gift-plus' },
] as const;

export function GiftsSection() {
  return (
    <section className="extra" id="hediye">
      <div className="wrap">
        <h2 className="block-title">Hediye Kartları</h2>
        <div className="gift-grid">
          {GIFTS.map((gift) => (
            <article className={gift.tone ? `gift ${gift.tone}` : 'gift'} key={gift.name}>
              <p>{gift.term}</p>
              <h3>{gift.name}</h3>
              <p>{gift.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
