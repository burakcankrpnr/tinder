const EVENTS = [
  { city: 'İstanbul', title: 'Çifte randevu gecesi', text: 'Dört kişilik masalar, tek bir kaydırma.' },
  { city: 'Ankara', title: 'Müzik modu', text: 'Aynı çalma listesinde buluşanlar.' },
  { city: 'İzmir', title: 'Kozmik uyum', text: 'Burçlar konuşur, sen dinlersin.' },
] as const;

export function EventsSection() {
  return (
    <section className="section" id="etkinlikler">
      <div className="wrap">
        <h2 className="block-title">Etkinlikler</h2>
        <div className="events">
          {EVENTS.map((event) => (
            <article className="event" key={event.city}>
              <p>{event.city}</p>
              <h3>{event.title}</h3>
              <p>{event.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
