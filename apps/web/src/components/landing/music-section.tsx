import { MusicIcon } from './icons';
import { PhoneMock } from './visuals';

export function MusicSection() {
  return (
    <section id="music-mode" className="offwhite">
      <div className="panel">
        <div className="panel-inner">
          <h2>
            Bir şarkı, <em>“selam”</em> demekten daha etkilidir.
          </h2>
          <p className="label">Müzik Modu</p>
        </div>
      </div>
      <div className="split">
        <div>
          <span className="icon-badge">
            <MusicIcon />
          </span>
          <h3>Atlamak yok</h3>
          <p className="lead">
            Dinlediğin müziği profiline ekle. <strong>Müzik Modu</strong>, seninle benzer müzik zevklerine sahip
            kişileri gösterir. Çalma listen, sohbeti başlatmanın harika bir yolu olacak.
          </p>
        </div>
        <PhoneMock />
      </div>
    </section>
  );
}
