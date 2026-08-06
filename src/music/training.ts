import { FRET_MAX, KEYS, MINOR_FAM, OPEN_MIDI, STRING_A } from './constants';
import { pattern, rootFret } from './fretboard';
import { applyMotif, motifExtra } from './motifs';
import { MODE_NAMES, modeScale, scaleById, scaleInfo } from './scales';
import { spell } from './spelling';
import type { KeyDef, ModeScale, Scale, ScaleId } from './types';

export type Exercise = 'one' | 'cycle';

/** Réglages d'entraînement, tels que stockés dans l'état de l'application. */
export interface TrainSettings {
  tScale: ScaleId;
  tKey: number;
  tRs: number;
  tEx: Exercise;
  tMode: number;
  tFull: boolean;
  tMotif: string;
  tempo: number;
}

export interface TrainCfg {
  parent: Scale;
  key: KeyDef;
  parentTonic: string;
  rs: number;
  names?: string[];
  nModes: number;
  ex: Exercise;
  mi: number;
  tempo: number;
  /** suite des modes à parcourir : un seul, ou aller-retour sur le cycle */
  seq: number[];
  full: boolean;
  motif: string;
  extra: number;
}

/** Réglages bruts → configuration résolue (modes disponibles, séquence, extensions). */
export function trainCfg(s: TrainSettings): TrainCfg {
  const parent = scaleById(s.tScale);
  const key = KEYS.filter((k) => k.pc === s.tKey)[0] ?? KEYS[0];
  const rs = s.tRs ?? STRING_A;
  const parentTonic = MINOR_FAM[parent.id] ? key.min : key.maj;
  const names = MODE_NAMES[parent.id];
  const nModes = names ? names.length : 1;
  const ex: Exercise = names ? s.tEx : 'one';
  const mi = Math.min(s.tMode, nModes - 1);

  let seq = [mi];
  if (ex === 'cycle') {
    seq = [];
    for (let i = 0; i < nModes; i++) seq.push(i);
    for (let i = nModes - 2; i >= 0; i--) seq.push(i);
  }

  return {
    parent,
    key,
    parentTonic,
    rs,
    names,
    nModes,
    ex,
    mi,
    tempo: s.tempo,
    seq,
    full: s.tFull,
    motif: s.tMotif,
    extra: s.tFull ? 0 : motifExtra(s.tMotif),
  };
}

interface PoolNote {
  str: number;
  off: number;
  d: number;
  v: number;
  midi: number;
}

/** Une note de l'exercice, dans l'ordre de lecture. */
export interface Step {
  /** rang du mode dans la séquence */
  slot: number;
  /** index du mode */
  m: number;
  M: ModeScale;
  /** frette de la fondamentale pour ce mode */
  f: number;
  str: number;
  off: number;
  d: number;
  midi: number;
  label: string;
}

/** Séquence complète de l'exercice : chaque mode de `seq`, motif appliqué. */
export function trainSteps(c: TrainCfg): Step[] {
  const steps: Step[] = [];

  c.seq.forEach((m, slot) => {
    const M = modeScale(c.parent, c.parentTonic, c.key.pc, m);
    const f = rootFret(M.sc, M.pc, c.rs, c.extra);
    const p = pattern(M.sc, c.rs, c.extra, c.extra, -f, FRET_MAX - f);

    let asc: PoolNote[];
    let i0 = 0;
    let iTop = -1;

    if (c.full) {
      // Position 4 cordes : toutes les notes de la gamme dans la fenêtre, de la plus grave
      // à la plus aiguë, doublons de hauteur écartés.
      const inf = scaleInfo(M.sc);
      const pool: PoolNote[] = [];
      for (let s = 3; s >= 0; s--) {
        for (let o = p.start; o <= p.end; o++) {
          const iv = ((((OPEN_MIDI[s] + o) - OPEN_MIDI[c.rs]) % 12) + 12) % 12;
          const g = inf[iv];
          if (g) pool.push({ str: s, off: o, d: g.d, v: g.v, midi: OPEN_MIDI[s] + f + o });
        }
      }
      pool.sort((a, b) => a.midi - b.midi);
      asc = pool.filter((n, i) => i === 0 || n.midi !== pool[i - 1].midi);
    } else {
      asc = p.notes
        .slice()
        .sort((a, b) => a.v - b.v)
        .map((n) => ({
          str: n.str,
          off: n.off,
          d: n.d,
          v: n.v,
          midi: OPEN_MIDI[n.str] + f + n.off,
        }));
    }

    asc.forEach((n, i) => {
      if (c.full) {
        if (n.d === 1) {
          if (iTop < 0) i0 = i;
          iTop = i;
        }
      } else {
        if (n.v === 0) i0 = i;
        if (n.v === 12) iTop = i;
      }
    });
    if (iTop <= i0) {
      i0 = 0;
      iTop = asc.length - 1;
    }

    applyMotif(asc, c.motif, i0, iTop).forEach((n) =>
      steps.push({
        slot,
        m,
        M,
        f,
        str: n.str,
        off: n.off,
        d: n.d,
        midi: n.midi,
        label: spell(M.tonic, n.d, M.pc + n.v),
      }),
    );
  });

  return steps;
}

/** Une colonne de tablature : une note, ou une colonne vide de complément de mesure. */
export interface TabCol {
  /** barre de mesure à droite de la colonne */
  bar: boolean;
  /** index absolu de la note dans la séquence, `null` si colonne de complément */
  step: number | null;
  str: number;
  n: string;
}

export interface TabSystem {
  cols: TabCol[];
  /** largeur relative du système : le dernier est mis à l'échelle de son contenu */
  width: string;
  minw: string;
}

const PER_SYSTEM = 16; // 4 mesures de 4 temps

/** Découpe la séquence en systèmes de 4 mesures, dernier système complété à la mesure près. */
export function tabSystems(steps: Step[]): TabSystem[] {
  const sys: TabSystem[] = [];
  for (let s0 = 0; s0 < steps.length; s0 += PER_SYSTEM) {
    const chunk = steps.slice(s0, s0 + PER_SYSTEM);
    const len = Math.min(PER_SYSTEM, Math.ceil(chunk.length / 4) * 4);
    const cols: TabCol[] = [];
    for (let ci = 0; ci < len; ci++) {
      const st = chunk[ci];
      cols.push({
        bar: ci % 4 === 3 && ci !== len - 1,
        step: st ? s0 + ci : null,
        str: st ? st.str : -1,
        n: st ? String(st.f + st.off) : '',
      });
    }
    sys.push({
      cols,
      width: (len / PER_SYSTEM) * 100 + '%',
      minw: len * 24 + 'px',
    });
  }
  return sys;
}
