import { PeopleIcon } from './icons';
import { PeopleFrame } from './visuals';

export function DoubleDateSection() {
  return (
    <section id="double-date" className="romance">
      <div className="panel">
        <div className="panel-inner">
          <h2>
            Sen + arkadaşın
            <br />
            O + arkadaşı
            <br />
            Mükemmel bir formül
          </h2>
          <h2>
            İlk buluşmalar, arkadaşlarla birlikte <em>daha güzel</em>
          </h2>
          <p className="label">Çifte Randevu ile Tanış.</p>
        </div>
      </div>
      <div className="split">
        <div>
          <span className="icon-badge">
            <PeopleIcon />
          </span>
          <h3>
            <em>Dört</em> kişilik bir parti
          </h3>
          <p className="lead">
            İlk buluşmalar iş görüşmesi gibi olmak zorunda değil. <strong>Çifte Randevu</strong> tüm denklemi
            değiştiriyor: Sen kendi arkadaşını getiriyorsun, o da kendininkini getiriyor. Birdenbire masada,
            sürprizlerle dolu bir sohbete dalan dört kişi oluyorsunuz. Daha az baskı. Daha fazla eğlence. Her yönüyle
            unutulmaz bir gece.
          </p>
        </div>
        <PeopleFrame />
      </div>
    </section>
  );
}
