import { PeopleFrame } from './visuals';

export function WhySection() {
  return (
    <section id="what-is-tinder" className="romance">
      <div className="wrap why why-pad">
        <PeopleFrame stars className="why-visual" />
        <div>
          <h2>
            Peki ama <em>neden</em> Tinder?
          </h2>
          <p>
            Çifte Randevu, Müzik Modu, Astroloji Modu, Passport, İlişki Hedefleri ve Fotoğraf Doğrulama gibi özelliklerle
            Tinder, kaydırma özelliğini kullanıma sunduğumuzdan beri 55 milyardan fazla eşleşmeyle 190 ülkede
            erişilebilen dünyanın en popüler flört uygulaması olmaya devam ediyor. Bu eşleşmelerin her birinin arkasında
            gerçek bir insan var.
          </p>
          <p>
            Bir profil oluştur, tercihlerini ayarla ve kaydırmaya başla. Birini Beğendiğinde o da seni Beğenirse,
            eşleştiniz demektir. Gerisi sana kalmış. Bir mesaj gönder, bir plan yap, bakalım ne olacak.
          </p>
          <p>iOS ve Android için Tinder uygulamasını ücretsiz indir.</p>
        </div>
      </div>
    </section>
  );
}
