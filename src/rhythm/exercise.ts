export interface Bar {
  /** notes par temps : 1 = noires, 2 = croches, 4 = doubles croches */
  subdivision: number;
  nom: string;
  court: string;
}

/** Mesures à 4 temps : noires, croches, doubles, croches, noires. */
export const EXERCISE: Bar[] = [
  { subdivision: 1, nom: 'Noires', court: '♩' },
  { subdivision: 2, nom: 'Croches', court: '♪' },
  { subdivision: 4, nom: 'Doubles croches', court: '♬' },
  { subdivision: 2, nom: 'Croches', court: '♪' },
  { subdivision: 1, nom: 'Noires', court: '♩' },
];

export const BEATS_PER_BAR = 4;
/** Mesure de décompte avant le départ. */
export const COUNT_IN_BEATS = 4;

export interface ExpectedNote {
  /** position en temps depuis le début de l'exercice, décompte exclu */
  beat: number;
  bar: number;
  indexInBar: number;
  subdivision: number;
}

/**
 * Grille des notes attendues.
 *
 * En contretemps, chaque note est décalée d'une **demi-valeur de sa subdivision** :
 * les noires tombent sur les « et », les croches entre les croches, etc. Le métronome,
 * lui, reste sur les temps — c'est lui la référence.
 */
export function buildGrid(offBeat: boolean, bars: Bar[] = EXERCISE): ExpectedNote[] {
  const out: ExpectedNote[] = [];
  let beat = 0;
  bars.forEach((b, bar) => {
    const step = 1 / b.subdivision;
    const shift = offBeat ? step / 2 : 0;
    for (let i = 0; i < BEATS_PER_BAR * b.subdivision; i++) {
      out.push({
        beat: beat + i * step + shift,
        bar,
        indexInBar: i,
        subdivision: b.subdivision,
      });
    }
    beat += BEATS_PER_BAR;
  });
  return out;
}

export const totalBeats = (bars: Bar[] = EXERCISE): number => bars.length * BEATS_PER_BAR;

export type Verdict = 'juste' | 'correct' | 'imprecis' | 'manque';

export interface NoteResult {
  note: ExpectedNote;
  /** écart en millisecondes : négatif en avance, positif en retard */
  devMs: number | null;
  verdict: Verdict;
}

export interface Score {
  results: NoteResult[];
  /** attaques détectées ne correspondant à aucune note attendue */
  extras: number;
  /** écart absolu moyen, sur les notes jouées */
  meanAbsMs: number;
  /** écart signé médian : négatif = en avance, positif = en retard */
  medianSignedMs: number;
  played: number;
  juste: number;
  correct: number;
  imprecis: number;
  manque: number;
}

export const JUSTE_MS = 20;
export const CORRECT_MS = 45;

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Apparie les attaques détectées aux notes attendues.
 *
 * @param expectedTimes dates attendues sur l'horloge audio, même ordre que `notes`
 * @param detections    dates détectées, déjà corrigées de la latence d'entrée
 */
export function scoreRun(
  notes: ExpectedNote[],
  expectedTimes: number[],
  detections: number[],
  spb: number,
): Score {
  const used = new Array(detections.length).fill(false);
  const results: NoteResult[] = [];

  notes.forEach((note, i) => {
    // Fenêtre d'appariement : une demi-valeur de la subdivision, plafonnée à 150 ms,
    // pour ne pas rattacher une attaque à la mauvaise note dans les doubles croches.
    const half = (spb / note.subdivision) / 2;
    const win = Math.min(half, 0.15);

    let best = -1;
    let bestDev = Infinity;
    detections.forEach((d, j) => {
      if (used[j]) return;
      const dev = d - expectedTimes[i];
      if (Math.abs(dev) <= win && Math.abs(dev) < Math.abs(bestDev)) {
        best = j;
        bestDev = dev;
      }
    });

    if (best < 0) {
      results.push({ note, devMs: null, verdict: 'manque' });
      return;
    }
    used[best] = true;
    const ms = bestDev * 1000;
    const abs = Math.abs(ms);
    results.push({
      note,
      devMs: ms,
      verdict: abs <= JUSTE_MS ? 'juste' : abs <= CORRECT_MS ? 'correct' : 'imprecis',
    });
  });

  const devs = results.filter((r) => r.devMs !== null).map((r) => r.devMs as number);
  const count = (v: Verdict): number => results.filter((r) => r.verdict === v).length;

  return {
    results,
    extras: used.filter((u) => !u).length,
    meanAbsMs: devs.length ? devs.reduce((a, b) => a + Math.abs(b), 0) / devs.length : 0,
    medianSignedMs: median(devs),
    played: devs.length,
    juste: count('juste'),
    correct: count('correct'),
    imprecis: count('imprecis'),
    manque: count('manque'),
  };
}
