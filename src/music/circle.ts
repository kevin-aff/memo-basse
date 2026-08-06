import type { ChordQuality } from '../audio/engine';
import { chords } from './chords';
import { FLAT, KEYS, SHARP } from './constants';
import { scaleById } from './scales';
import { spell } from './spelling';
import type { Panel, ScaleId } from './types';

/** Ordre d'apparition des dièses et des bémols à l'armure. */
const SH = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FL = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** Nombre d'altérations par tonalité majeure — positif pour les ♯, négatif pour les ♭. */
const SIG: Record<number, number> = {
  0: 0,
  7: 1,
  2: 2,
  9: 3,
  4: 4,
  11: 5,
  6: 6,
  1: -5,
  8: -4,
  3: -3,
  10: -2,
  5: -1,
};

const majOf = (p: number): string => KEYS.filter((k) => k.pc === ((p % 12) + 12) % 12)[0].maj;
const minOf = (p: number): string => KEYS.filter((k) => k.pc === ((p % 12) + 12) % 12)[0].min;

export type Ring = 'maj' | 'min' | 'dim';

/**
 * Géométrie des anneaux dans le repère SVG `viewBox="0 0 100 100"` :
 * rayons interne/externe du secteur, et rayon où se pose le libellé HTML.
 */
const RINGS: Record<Ring, { ri: number; ro: number; lr: number }> = {
  maj: { ri: 36, ro: 49, lr: 42.5 },
  min: { ri: 24, ro: 36, lr: 30 },
  dim: { ri: 12, ro: 24, lr: 18 },
};

/** Rayon du disque central. */
export const HUB_R = 12;

const P = (a: number, r: number): string => {
  const t = ((a - 90) * Math.PI) / 180;
  return (50 + r * Math.cos(t)).toFixed(2) + ',' + (50 + r * Math.sin(t)).toFixed(2);
};

/** Secteur de 30° : arc externe, segment, arc interne en sens inverse. */
const wedge = (i: number, ri: number, ro: number): string => {
  const a0 = i * 30 - 15;
  const a1 = i * 30 + 15;
  return (
    'M' + P(a0, ro) +
    ' A' + ro + ',' + ro + ' 0 0 1 ' + P(a1, ro) +
    ' L' + P(a1, ri) +
    ' A' + ri + ',' + ri + ' 0 0 0 ' + P(a0, ri) +
    ' Z'
  );
};

const pos = (i: number, R: number): { x: string; y: string } => {
  const a = ((-90 + i * 30) * Math.PI) / 180;
  return {
    x: (50 + R * Math.cos(a)).toFixed(2),
    y: (50 + R * Math.sin(a)).toFixed(2),
  };
};

export interface CircleNode {
  label: string;
  sub: string;
  /** tracé SVG du secteur */
  d: string;
  /** position du libellé HTML superposé, en pourcentage */
  lx: string;
  ly: string;
  isTonic: boolean;
  inKey: boolean;
  plain: boolean;
  /** tonalité sélectionnée au clic */
  target: { pc: number; min: boolean };
  /** accord joué au clic */
  rootPc: number;
  quality: ChordQuality;
}

export interface CircleVals {
  cTonic: string;
  cSigShort: string;
  circleMaj: CircleNode[];
  circleMin: CircleNode[];
  circleDim: CircleNode[];
  cPanels: Panel[];
  /** hauteur de la tonique courante — ancre du voicing joué au clic */
  basePc: number;
  /** cible du bouton « Travailler … dans Gammes » */
  openTarget: { scaleId: ScaleId; keyPc: number };
}

/**
 * Contenu complet de la section Cercle des quintes pour une tonalité donnée.
 *
 * @param pcMaj hauteur de la tonalité majeure de référence (le secteur du cercle)
 * @param isMin la tonalité courante est la relative mineure de ce secteur
 * @param sev   accords diatoniques en tétrades (4 notes) plutôt qu'en triades
 * @param num   notation des degrés en chiffres plutôt qu'en symboles
 */
export function circleVals(pcMaj: number, isMin: boolean, sev: boolean, num = false): CircleVals {
  const relPc = (pcMaj + 9) % 12;
  const n = SIG[pcMaj];
  const sigShort =
    n === 0 ? 'aucune altération' : n > 0 ? n + ' ' + SHARP : -n + ' ' + FLAT;
  const sigNotes =
    n === 0
      ? '—'
      : n > 0
        ? SH.slice(0, n)
            .map((x) => x + SHARP)
            .join('  ')
        : FL.slice(0, -n)
            .map((x) => x + FLAT)
            .join('  ');

  const pc = isMin ? relPc : pcMaj;
  const tonic = isMin ? minOf(relPc) : majOf(pcMaj);
  const scale = scaleById(isMin ? 'min' : 'maj');

  // Index du secteur de la tonique : i tel que (i * 7) % 12 === pcMaj.
  const k = (pcMaj * 7) % 12;
  const rel = (i: number): number => (((i - k) % 12) + 12) % 12;

  /** Suffixe des accords mineurs sur la roue, selon triades / tétrades. */
  const mn = sev ? 'm7' : 'm';

  const mk = (
    i: number,
    ring: Ring,
    label: string,
    sub: string,
    inKey: boolean,
    isTonic: boolean,
    target: { pc: number; min: boolean },
    rootPc: number,
    quality: ChordQuality,
  ): CircleNode => {
    const g = RINGS[ring];
    const lo = pos(i, g.lr);
    return {
      label,
      sub: inKey ? sub : '',
      d: wedge(i, g.ri, g.ro),
      lx: lo.x,
      ly: lo.y,
      isTonic,
      inKey: inKey && !isTonic,
      plain: !inKey && !isTonic,
      target,
      rootPc,
      quality,
    };
  };

  const circleMaj: CircleNode[] = [];
  const circleMin: CircleNode[] = [];
  const circleDim: CircleNode[] = [];

  for (let i = 0; i < 12; i++) {
    const p = (i * 7) % 12;
    const d = rel(i);
    // Les 3 secteurs voisins (IV, I, V) portent les 7 accords de la tonalité.
    const inK = d === 0 || d === 1 || d === 11;
    const asMaj = { pc: p, min: false };

    circleMaj.push(
      mk(
        i,
        'maj',
        majOf(p),
        (d === 0 ? 'I' : d === 1 ? 'V' : 'IV') + (sev ? ' · ' + (d === 1 ? '7' : 'maj7') : ''),
        inK,
        !isMin && d === 0,
        asMaj,
        p,
        inK && d === 1 ? 'dom7' : 'maj7',
      ),
    );
    circleMin.push(
      mk(
        i,
        'min',
        minOf((p + 9) % 12) + 'm',
        (d === 0 ? 'vi' : d === 1 ? 'iii' : 'ii') + ' · ' + mn,
        inK,
        isMin && d === 0,
        { pc: p, min: true },
        (p + 9) % 12,
        'm7',
      ),
    );
    circleDim.push(
      mk(i, 'dim', majOf(((i + 5) * 7) % 12) + '°', 'vii°', d === 0, false, asMaj, ((i + 5) * 7) % 12, 'm7b5'),
    );
  }

  const cadence = isMin
    ? spell(tonic, 2, pc + 2) + 'm7' + FLAT + '5   ' + spell(tonic, 5, pc + 7) + '7   ' + tonic + 'm7'
    : spell(tonic, 2, pc + 2) + 'm7   ' + spell(tonic, 5, pc + 7) + '7   ' + tonic + 'maj7';

  const voisines = isMin
    ? [
        { l: 'Sous-dominante IV', v: minOf(pc + 5) + 'm' },
        { l: 'Dominante V', v: majOf(pc + 7) + '7' },
        { l: 'Relative majeure', v: majOf(pcMaj) },
        { l: 'Parallèle majeure', v: majOf(pc) },
      ]
    : [
        { l: 'Sous-dominante IV', v: majOf(pc + 5) },
        { l: 'Dominante V', v: majOf(pc + 7) },
        { l: 'Relative mineure', v: minOf(relPc) + 'm' },
        { l: 'Parallèle mineure', v: minOf(pc) + 'm' },
      ];

  const cPanels: Panel[] = [
    {
      title: 'Armure',
      big: sigNotes,
      lines: [
        { l: 'Altérations', v: sigShort },
        {
          l: n >= 0 ? 'Ordre des ' + SHARP : 'Ordre des ' + FLAT,
          v: (n >= 0 ? SH : FL).join(' '),
        },
        {
          l: 'Enharmonie',
          v:
            pcMaj === 6
              ? isMin
                ? 'D' + SHARP + 'm / E' + FLAT + 'm'
                : 'F' + SHARP + ' / G' + FLAT
              : '—',
        },
      ],
    },
    {
      title: 'Accords diatoniques',
      lines: [],
      table: chords(scale, pc, tonic, num, sev) ?? [],
    },
    {
      title: 'Cadence II - V - I',
      big: cadence,
      lines: [
        { l: 'Tonique', v: tonic + (isMin ? ' mineur' : ' majeur') },
        { l: 'Gamme', v: tonic + (isMin ? ' mineure naturelle' : ' majeure') },
      ],
    },
    { title: 'Tonalités voisines', lines: voisines },
  ];

  return {
    cTonic: tonic + (isMin ? 'm' : ''),
    cSigShort: sigShort,
    circleMaj,
    circleMin,
    circleDim,
    cPanels,
    basePc: pcMaj,
    openTarget: { scaleId: isMin ? 'min' : 'maj', keyPc: pc },
  };
}
