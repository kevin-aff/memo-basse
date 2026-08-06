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

/** Partiels du timbre piano : rang harmonique et gain relatif. */
const PARTIALS: [number, number][] = [
  [1, 1],
  [2, 0.3],
  [3, 0.12],
  [4, 0.055],
  [5, 0.022],
  [6, 0.01],
];

/**
 * Timbre piano, en synthèse additive : 6 partiels sinus, enveloppe percussive
 * (attaque 5 ms, chute à 32 % du pic en 160 ms, extinction exponentielle) et passe-bas
 * qui se referme sur la durée — c'est lui qui donne la percussion qui s'éteint plutôt
 * qu'un bourdon d'orgue.
 *
 * @param time date de départ sur l'horloge de l'`AudioContext` (arpèges, accords roulés)
 */
export function schedulePiano(
  ac: AudioContext,
  midi: number,
  time: number,
  dur: number,
  gainMul = 1,
): void {
  const f = midiToHz(midi);
  const amp = 0.34 * gainMul;

  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, time);
  out.gain.exponentialRampToValueAtTime(amp, time + 0.005);
  // Sur une note très courte (tempo rapide), la chute intermédiaire tomberait après
  // l'extinction : on la saute pour garder les points d'automation dans l'ordre.
  if (dur > 0.2) out.gain.exponentialRampToValueAtTime(amp * 0.32, time + 0.16);
  out.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(8000, f * 10), time);
  lp.frequency.exponentialRampToValueAtTime(Math.max(600, f * 3), time + dur * 0.8);

  out.connect(lp);
  lp.connect(ac.destination);

  PARTIALS.forEach(([harmonic, gain]) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = f * harmonic;
    g.gain.value = gain * 0.5;
    o.connect(g);
    g.connect(out);
    o.start(time);
    o.stop(time + dur + 0.08);
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
  midis.forEach((m, i) => schedulePiano(ac, m, t0 + i * step, step + 0.02));
}

export type ChordQuality = 'maj7' | 'dom7' | 'm7' | 'm7b5';
export type CircleSound = 'note' | 'arp' | 'chord';

const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
};

/**
 * Joue un accord du cercle des quintes.
 *
 * Le voicing est **ancré sur la tonique de la tonalité** : `root = 48 + ((rootPc − basePc) mod 12)`.
 * Toutes les fondamentales tiennent ainsi dans une même octave montante depuis la tonique — en do,
 * C / Dm / Em s'enchaînent en montant, sans décrochage d'octave.
 *
 * @param sev tétrades (4 notes) plutôt que triades (3 notes)
 */
export function playChord(
  rootPc: number,
  quality: ChordQuality,
  basePc: number,
  mode: CircleSound,
  sev: boolean,
): void {
  const ac = getCtx();
  if (!ac) return;
  const full = CHORD_INTERVALS[quality] ?? CHORD_INTERVALS.maj7;
  const iv = sev ? full : full.slice(0, 3);
  const root = 48 + ((((rootPc - basePc) % 12) + 12) % 12);
  const t0 = ac.currentTime + 0.03;

  if (mode === 'note') {
    schedulePiano(ac, root, t0, 2.4, 1);
    return;
  }
  if (mode === 'chord') {
    iv.forEach((v, i) => schedulePiano(ac, root + v, t0 + i * 0.012, 2.8, 0.42));
    return;
  }
  iv.forEach((v, i) => schedulePiano(ac, root + v, t0 + i * 0.17, 1.7, 0.7));
}
