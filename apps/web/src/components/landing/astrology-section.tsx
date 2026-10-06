import { MoonIcon } from './icons';
import { MoonArt } from './visuals';

export function AstrologySection() {
  return (
    <section id="astrology-mode" className="petal">
      <div className="panel">
        <div className="panel-inner">
          <h2>
            Birazcık <em>kozmik enerji</em> çok fark yaratır
          </h2>
          <p className="label">Astroloji Modu</p>
        </div>
      </div>
      <div className="split">
        <div>
          <span className="icon-badge">
            <MoonIcon />
          </span>
          <h3>
            <em>Kozmik</em> uyum
          </h3>
          <p className="lead">
            Burcun zaten kim olduğunu ele veriyor. <strong>Astroloji Modu</strong>, burcunu profiline eklemene, karşı
            tarafın burcunu görmene ve harika bir sohbete dalmana olanak tanır. Profilleri uyumluluğa göre
            filtreleyebilir veya doğal akışına bırakabilirsin. Merkür retrosu da başladığına göre şimdi harekete geçme
            vakti. Haydi görelim seni.
          </p>
        </div>
        <div className="cards-row">
          <div className="mini-card">
            <MoonArt small />
            <strong>Ateş + Hava</strong>
            <p>Konuşma kendiliğinden akar.</p>
          </div>
          <div className="mini-card mini-card-night">
            <p>Uyum</p>
            <strong>%86</strong>
            <p>Burçlar bu akşam aynı masada.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
