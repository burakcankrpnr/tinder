import { FlameIcon } from './icons';
import { OpenAuthButton } from './landing-ui';

export function DownloadBand() {
  return (
    <section className="download-band" id="download">
      <div className="download-row">
        <div>
          <h2>Yeterince okudun. Artık keşfet.</h2>
          <OpenAuthButton mode="signup" className="btn btn-light">
            Tinder&apos;ı indir
          </OpenAuthButton>
        </div>
        <FlameIcon className="flame-mark" />
      </div>
    </section>
  );
}
