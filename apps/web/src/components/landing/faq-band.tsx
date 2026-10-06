import Link from 'next/link';

export function FaqBand() {
  return (
    <section className="faq-band" id="sss">
      <h2>
        Soruların mı var? Belki <em>bazılarına</em> cevap bulabiliriz.
      </h2>
      <Link className="btn btn-ghost" href="/#destek">
        SSS Sayfasına Git
      </Link>
      <p className="fine">
        1. Yüz Kontrolü, belirli konumlarda mevcuttur ve gereksinimler konuma göre değişiklik gösterebilir.
      </p>
    </section>
  );
}
