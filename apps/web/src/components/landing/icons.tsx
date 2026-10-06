type IconProps = { className?: string };

export function FlameIcon({ className }: IconProps) {
  return (
    <svg className={className} width="28" height="36" viewBox="0 0 24 32" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1c.4 5.2-3.2 7.4-3.6 13.2C8 18.8 10.2 22 14 22c2.2 0 3.4-1.2 3.4-3.2 0-1.6-.8-2.4-.8-4 2.2 1.5 3.8 4.2 3.8 7.2A8.6 8.6 0 1 1 7.2 14C8 8.6 11 5.2 12 1z"
      />
    </svg>
  );
}

export function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5h10v2h-3.2c.7 1.5 1.8 2.8 3.2 3.8l-.8 1.8A12 12 0 0 1 8.4 10 10 10 0 0 1 6 13H4c.5-1.2 1.3-2.3 2.3-3.3C5.2 8.6 4.5 7.4 4.2 6H2V5h2zm12.2 7 3.6 9h-2.2l-.7-2h-4.2l-.7 2H10l3.6-9h2.6zm-2.2 5.2h2.8L15.4 14l-1.4 3.2z"
      />
    </svg>
  );
}

export function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm8-1a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM2 19c.4-3 2.8-5 6-5s5.6 2 6 5H2zm10.2 0c.2-1.6.8-3 1.8-4.1 1.2-.3 2.6-.1 3.8.6 1.6 1 2.6 2.5 3 3.5h-8.6z"
      />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a8 8 0 1 0 7.7 10h-2.1A6 6 0 1 1 12 6V2zm8 3.2 1 2.4 2.5.4-1.8 1.7.4 2.5L20 11.1 17.9 12.2l.4-2.5-1.8-1.7 2.5-.4 1-2.4z"
      />
    </svg>
  );
}

export function MusicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 4v10.2A3.5 3.5 0 1 0 11 17V8l8-2v7.2A3.5 3.5 0 1 0 21 16V3L9 6V4z"
      />
    </svg>
  );
}
