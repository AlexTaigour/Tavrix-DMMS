import React, { useEffect } from 'react';
import { CAFE_LOGO, CAFE_NAME } from '../utils/brand';

export default function BrewingLoader({
  label = 'Brewing',
  splash = false,
  fullscreen = false,
  tone = 'dark',
}) {
  const dark = tone === 'dark';
  useEffect(() => {
    if (!splash && !fullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [fullscreen, splash]);

  const art = (
    <div className={`brew-loader-art ${dark ? 'is-dark' : 'is-light'}`} aria-hidden="true">
      <div className="brew-loader-aura" />
      <div className="brew-loader-orbit brew-loader-orbit--outer"><i /></div>
      <div className="brew-loader-orbit brew-loader-orbit--inner"><i /></div>
      <div className="brew-loader-cup-position">
        <div className="brew-loader-steam">
          <i />
          <i />
          <i />
        </div>
        <div className="brew-loader-handle" />
        <div className="brew-loader-cup">
          <div className="brew-loader-tea">
            <i />
            <i />
            <i />
          </div>
          <div className="brew-loader-glass-shine" />
        </div>
        <div className="brew-loader-saucer" />
      </div>
    </div>
  );
  const panelClass = [
    'brew-loader-panel',
    splash ? 'is-splash' : fullscreen ? 'is-fullscreen' : 'is-inline',
    dark ? 'is-dark' : 'is-light',
  ].join(' ');

  const content = (
    <div className={panelClass} role="status" aria-live="polite">
      {(splash || fullscreen) && (
        <div className="brew-loader-brand">
          <img src={CAFE_LOGO} alt="" decoding="async" />
          {splash && <span>{CAFE_NAME}</span>}
        </div>
      )}
      {splash && <p className="brew-loader-tagline">A little warmth is on the way</p>}
      {art}
      <p className="brew-loader-label">
        {label}<span className="brew-loader-ellipsis" aria-hidden="true">...</span>
      </p>
      <div className="brew-loader-progress" aria-hidden="true"><span /></div>
      {splash && <p className="brew-loader-caption">MADE FRESH · SERVED WARM</p>}
    </div>
  );

  if (splash) {
    return (
      <div className="brew-loader-screen is-dark">
        <div className="brew-loader-backdrop-glow" />
        <div className="brew-loader-backdrop-glow brew-loader-backdrop-glow--second" />
        <div className="brew-loader-grain" />
        {content}
      </div>
    );
  }

  if (fullscreen) {
    return <div className="brew-loader-screen is-light">{content}</div>;
  }

  return <div className="brew-loader-inline">{content}</div>;
}
