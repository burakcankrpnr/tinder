import Link from 'next/link';
import { OpenAuthButton } from './landing-ui';

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-inner">
        <h1>Her şey bir kaydırmayla başlar.</h1>
        <div className="hero-actions">
          <Link className="btn btn-secondary" href="/#download">
            Uygulamayı indir
          </Link>
          <OpenAuthButton mode="signup" className="btn btn-primary">
            Hesap Oluştur
          </OpenAuthButton>
        </div>
      </div>
      <div className="hero-hint">
        <p>Tinder&apos;da tanışacağın birileri içinde kelebekler uçurabilir.</p>
        <p>Kim olduğuna bak ↓</p>
      </div>
      <div className="hero-note">Tüm fotoğraflar, açıklayıcı olması amacıyla temsili olarak kullanılmıştır</div>
    </section>
  );
}
