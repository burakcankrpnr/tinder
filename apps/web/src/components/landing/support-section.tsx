const QUESTIONS = [
  {
    question: 'Tinder nasıl çalışır?',
    answer: 'Profilini kur, kimi görmek istediğini seç ve kaydır. Karşılıklı beğeni olursa eşleşirsiniz ve sohbet oradan başlar.',
    open: true,
  },
  {
    question: 'Hesabımı nasıl oluştururum?',
    answer: "Hesap Oluştur'a bas, adını ve e-postanı gir. Bu önizlemede bilgiler yalnız bu tarayıcıda saklanır.",
    open: false,
  },
  {
    question: 'Birini nasıl engellerim?',
    answer: 'Eşleşme ekranından engelle, eşleşmeyi kaldır veya şikayet et. Kontrol sende kalır.',
    open: false,
  },
  {
    question: 'Fotoğraf doğrulama nedir?',
    answer: 'Kısa bir yüz kontrolü, profil fotoğraflarının sana ait olduğunu göstermeye yardım eder.',
    open: false,
  },
] as const;

export function SupportSection() {
  return (
    <section className="section" id="destek">
      <div className="wrap">
        <h2 className="block-title">Destek</h2>
        <div className="accordion">
          {QUESTIONS.map((item) => (
            <details key={item.question} open={item.open}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
