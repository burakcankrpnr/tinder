'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LANGUAGES, type LandingLang, type LangAnchor } from './nav';

type ModalName = 'login' | 'signup';

type LandingUiValue = {
  lang: LandingLang;
  headerLangLabel: string;
  footerLangLabel: string;
  setLang: (lang: LandingLang) => void;
  langAnchor: LangAnchor | null;
  toggleLang: (anchor: LangAnchor) => void;
  closeLang: () => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  closeMenu: () => void;
  modal: ModalName | null;
  openModal: (modal: ModalName) => void;
  closeModal: () => void;
};

const LandingUiContext = createContext<LandingUiValue | null>(null);

export function useLandingUi() {
  const value = useContext(LandingUiContext);
  if (!value) throw new Error('Landing bileşenleri LandingFrame içinde kullanılmalı.');
  return value;
}

export function LandingUiProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LandingLang>('tr');
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  const [langAnchor, setLangAnchor] = useState<LangAnchor | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<ModalName | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const setLang = useCallback((next: LandingLang) => {
    const match = LANGUAGES.find((item) => item.id === next);
    setLangState(next);
    setPickedLabel(match?.label ?? next);
    setLangAnchor(null);
    document.documentElement.lang = next;
  }, []);

  const closeLang = useCallback(() => setLangAnchor(null), []);
  const toggleLang = useCallback((anchor: LangAnchor) => {
    setLangAnchor((current) => (current === anchor ? null : anchor));
  }, []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const openModal = useCallback((next: ModalName) => {
    setMenuOpen(false);
    setLangAnchor(null);
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setModal(next);
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
    opener.current?.focus();
    opener.current = null;
  }, []);

  useEffect(() => {
    if (!modal) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [modal, closeModal]);

  const value = useMemo<LandingUiValue>(
    () => ({
      lang,
      headerLangLabel: pickedLabel ?? 'Dil',
      footerLangLabel: pickedLabel ?? 'Türkçe',
      setLang,
      langAnchor,
      toggleLang,
      closeLang,
      menuOpen,
      setMenuOpen,
      closeMenu,
      modal,
      openModal,
      closeModal,
    }),
    [lang, pickedLabel, setLang, langAnchor, toggleLang, closeLang, menuOpen, closeMenu, modal, openModal, closeModal],
  );

  return <LandingUiContext.Provider value={value}>{children}</LandingUiContext.Provider>;
}

export function OpenAuthButton({
  mode,
  className,
  children,
}: {
  mode: ModalName;
  className?: string;
  children: ReactNode;
}) {
  const { openModal } = useLandingUi();
  return (
    <button type="button" className={className} onClick={() => openModal(mode)}>
      {children}
    </button>
  );
}
