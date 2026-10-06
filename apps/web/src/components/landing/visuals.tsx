export function AvatarScene() {
  return (
    <div className="scene">
      <span className="avatar" />
      <span className="avatar" />
      <span className="avatar" />
      <span className="avatar" />
    </div>
  );
}

export function MoonArt({ small = false }: { small?: boolean }) {
  return <div className={small ? 'moon moon-sm' : 'moon'} />;
}

export function NotesArt() {
  return (
    <div className="notes">
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

export function PeopleFrame({ stars = false, className }: { stars?: boolean; className?: string }) {
  return (
    <div className={className ? `frame ${className}` : 'frame'} aria-hidden="true">
      {stars ? <div className="stars" /> : null}
      <div className="people">
        <span className="person" />
        <span className="person" />
        <span className="person" />
        <span className="person" />
      </div>
    </div>
  );
}

export function PhoneMock() {
  return (
    <div className="music-visual" aria-hidden="true">
      <div className="phone">
        <div className="screen">
          <p>Bu hafta</p>
          <div className="bar" />
          <div className="bar short" />
          <div className="bar" />
          <NotesArt />
        </div>
      </div>
    </div>
  );
}
