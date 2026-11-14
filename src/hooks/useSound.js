import { useCallback, useState } from 'react';

// Two-tone chime via Web Audio — no asset file needed. Mute preference
// persists per device (it's a device setting, not account data).
export function useSound(storageKey = 'tvx_sound') {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(storageKey) !== 'off');

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      localStorage.setItem(storageKey, prev ? 'off' : 'on');
      return !prev;
    });
  }, [storageKey]);

  const playTones = useCallback((tones) => {
    if (localStorage.getItem(storageKey) === 'off') return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      tones.forEach(([freq, start, dur, type = 'sine']) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      });
      setTimeout(() => ctx.close(), 1000);
    } catch {}
  }, [storageKey]);

  const chime = useCallback(() => {
    playTones([[880, 0, 0.35], [1174.66, 0.18, 0.45]]);
  }, [playTones]);

  const wrong = useCallback(() => {
    playTones([[330, 0, 0.12, 'square'], [220, 0.16, 0.18, 'square']]);
  }, [playTones]);

  return { enabled, toggle, chime, wrong };
}
