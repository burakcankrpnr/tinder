import { Carousel } from './carousel';

const CARDS = [
  {
    kicker: 'Doğrulama',
    title: 'Güvenle bağlantı kur',
    text: 'Fotoğraf Doğrulama ve Yüz Kontrolü¹ gibi doğrulama özellikleri, profilin gerçek bir kişiye ait olduğundan emin olmana yardımcı olur.',
    shot: '',
  },
  {
    kicker: 'Saygı',
    title: 'Saygılı sohbet et.',
    text: 'Are You Sure? ve Does This Bother You? gibi güvenli sohbet özellikleri, konuşmaların saygı çerçevesinde kalmasına yardımcı olur. Böylece sen de aşk kıvılcımlarına odaklanabilirsin.',
    shot: 'shot-respect',
  },
  {
    kicker: 'Denetim',
    title: 'Kontrol sende kalsın.',
    text: 'Hoşuna gitmeyen bir şey mi var? Eşleşmeni engelleyebilir, eşleşmeyi kaldırabilir veya sınırı aşan her şeyi bildirebilirsin.',
    shot: 'shot-control',
  },
  {
    kicker: 'Destek',
    title: 'Güvenle buluş.',
    text: "Randevumu Paylaş'tan Güvenlik İpuçları'na kadar, işler gerçek hayatta buluşmaya dönmeden önce biraz destek al.",
    shot: 'shot-support',
  },
] as const;

export function SafetySection() {
  return (
    <section id="safety" className="haze">
      <div className="panel">
        <div className="panel-inner">
          <h2>Güvenliğin her şeyden önce gelir.</h2>
          <h2>Eşleşirken, sohbet ederken ve buluşurken daha güvende hisset.</h2>
          <p className="label">Tinder&apos;da Güvenlik</p>
        </div>
      </div>
      <div className="section safety-body">
        <div className="wrap safety-head">
          <h2 className="block-title">Güvenliğe yaklaşımımız</h2>
          <p>
            Yüz Kontrolü¹, Fotoğraf Doğrulama, Randevumu Paylaş, engelleme, eşleşmeyi kaldırma ve şikayet etme. Hepsi
            elinin altında. Bu özellikler, her adımda kontrolü elinde tutmana yardımcı olmak için tasarlandı.
          </p>
        </div>
        <div className="wrap-wide">
          <Carousel id="safety-carousel" label="Güvenlik özellikleri">
            {CARDS.map((card) => (
              <article className="safety-card" key={card.kicker}>
                <p className="kicker">{card.kicker}</p>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <div className={card.shot ? `shot ${card.shot}` : 'shot'} />
              </article>
            ))}
          </Carousel>
        </div>
      </div>
    </section>
  );
}
