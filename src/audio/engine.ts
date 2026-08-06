let ctx: AudioContext | null = null;

/**
 * `AudioContext` unique, créée à la première lecture.
 * Les navigateurs exigent un geste utilisateur : n'appeler que depuis un gestionnaire d'événement.
 */
export function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Note de basse : triangle à la fondamentale + sinus à l'octave. */
export function scheduleTone(
  ac: AudioContext,
  midi: number,
  time: number,
  dur: number,
  gainMul = 1,
): void {
  const fr = midiToHz(midi);
  const voices: [number, number, OscillatorType][] = [
    [fr, 0.3 * gainMul, 'triangle'],
    [fr * 2, 0.12 * gainMul, 'sine'],
  ];
  voices.forEach(([freq, peak, type]) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start(time);
    o.stop(time + dur + 0.02);
  });
}

/** Clic de métronome : square 1760 Hz accentué, 1100 Hz sinon. */
export function scheduleClick(ac: AudioContext, accent: boolean, time: number): void {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'square';
  o.frequency.value = accent ? 1760 : 1100;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.14, time + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, time + (accent ? 0.09 : 0.055));
  o.connect(g);
  g.connect(ac.destination);
  o.start(time);
  o.stop(time + 0.12);
}

/** Lecture immédiate d'une suite de notes, une par `step` secondes. */
export function playSequence(midis: number[], step = 0.3): void {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + 0.06;
  midis.forEach((m, i) => scheduleTone(ac, m, t0 + i * step, step + 0.02));
}
