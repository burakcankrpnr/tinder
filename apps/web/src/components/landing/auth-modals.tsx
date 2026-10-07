'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { useLandingUi } from './landing-ui';

const STORAGE_KEY = 'landing-preview-account';

type PreviewAccount = {
  name: string;
  email: string;
  birthday: string;
};

function ageFrom(birthday: string) {
  const date = new Date(birthday);
  if (Number.isNaN(date.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const month = now.getMonth() - date.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < date.getDate())) age -= 1;
  return age;
}

function readAccount(): PreviewAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (!('name' in parsed) || !('email' in parsed) || !('birthday' in parsed)) return null;
    const { name, email, birthday } = parsed;
    if (typeof name !== 'string' || typeof email !== 'string' || typeof birthday !== 'string') return null;
    return { name, email, birthday };
  } catch {
    return null;
  }
}

function SuccessBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="success-box">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export function AuthModals() {
  const { modal, closeModal, openModal } = useLandingUi();
  const titleId = useId();

  useEffect(() => {
    if (!modal) return;
    const node = document.getElementById('landing-auth-dialog');
    node?.querySelector<HTMLElement>('input')?.focus();
  }, [modal]);

  if (!modal) return null;

  return (
    <div className="modal">
      <button className="modal-backdrop" type="button" aria-label="Kapat" onClick={closeModal} />
      <div
        id="landing-auth-dialog"
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button className="close-x" type="button" onClick={closeModal} aria-label="Kapat">
          ×
        </button>
        {modal === 'signup' ? (
          <SignupForm titleId={titleId} />
        ) : (
          <LoginForm titleId={titleId} onSwitch={() => openModal('signup')} />
        )}
      </div>
    </div>
  );
}

function SignupForm({ titleId }: { titleId: string }) {
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [account, setAccount] = useState<PreviewAccount | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAccount(readAccount());
    setHydrated(true);
  }, []);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const birthday = String(data.get('birthday') ?? '');
    if (name.length < 2) {
      setError('Adın en az 2 karakter olmalı.');
      return;
    }
    if (ageFrom(birthday) < 18) {
      setError('Devam etmek için 18 yaşından büyük olmalısın.');
      return;
    }
    const created: PreviewAccount = { name, email, birthday };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(created));
    setError('');
    setDone(name);
  };

  return (
    <>
      <h2 id={titleId}>Hesap Oluştur</h2>
      <p>Adın profilinde böyle görünecek. Bu önizleme bilgileri yalnızca bu tarayıcıda tutar.</p>
      {done ? (
        <SuccessBox title={`Hoş geldin, ${done}.`} text="Hesabın bu tarayıcıda hazır. Kaydırmaya buradan devam edebilirsin." />
      ) : (
        <form onSubmit={onSubmit} autoComplete="on" key={hydrated ? (account?.email ?? 'new') : 'pending'}>
          <label>
            Ad
            <input name="name" required maxLength={40} autoComplete="name" defaultValue={account?.name ?? ''} />
          </label>
          <label>
            E-posta
            <input name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={account?.email ?? ''} />
          </label>
          <label>
            Doğum tarihi
            <input name="birthday" type="date" required autoComplete="bday" defaultValue={account?.birthday ?? ''} />
          </label>
          <p className="form-error" role="alert">
            {error}
          </p>
          <button className="btn btn-primary" type="submit">
            Devam
          </button>
        </form>
      )}
    </>
  );
}

function LoginForm({ titleId, onSwitch }: { titleId: string; onSwitch: () => void }) {
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [account, setAccount] = useState<PreviewAccount | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAccount(readAccount());
    setHydrated(true);
  }, []);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '')
      .trim()
      .toLowerCase();
    const saved = readAccount();
    if (!saved || saved.email.toLowerCase() !== email) {
      setError('Bu e-posta ile kayıtlı bir hesap yok. Önce hesap oluştur.');
      setDone(null);
      return;
    }
    setError('');
    setDone(saved.name);
  };

  return (
    <>
      <h2 id={titleId}>Oturum aç</h2>
      <p>Daha önce bu tarayıcıda hesap oluşturduysan aynı e-posta ile devam et.</p>
      {done ? (
        <SuccessBox title={`Tekrar merhaba, ${done}.`} text="Oturumun bu tarayıcıda açıldı." />
      ) : (
        <form onSubmit={onSubmit} autoComplete="on" key={hydrated ? (account?.email ?? 'new') : 'pending'}>
          <label>
            E-posta
            <input name="email" type="email" required autoComplete="username" inputMode="email" defaultValue={account?.email ?? ''} />
          </label>
          <p className="form-error" role="alert">
            {error}
          </p>
          <button className="btn btn-primary" type="submit">
            Oturum aç
          </button>
        </form>
      )}
      <p>
        Hesabın yok mu?{' '}
        <button type="button" className="linkish" onClick={onSwitch}>
          Hesap oluştur
        </button>
      </p>
    </>
  );
}
