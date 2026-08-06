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

export interface CircleNode {
  label: string;
  sub: string;
  /** position en pourcentage dans la roue */
  x: string;
  y: string;
  isTonic: boolean;
  inKey: boolean;
  plain: boolean;
  /** tonalité sélectionnée au clic */
  target: { pc: number; min: boolean };
}

export interface CircleVals {
  cTonic: string;
  cSigShort: string;
  circleMaj: CircleNode[];
  circleMin: CircleNode[];
  circleDim: CircleNode[];
  cPanels: Panel[];
  /** cible du bouton « Travailler … dans Gammes » */
  openTarget: { scaleId: ScaleId; keyPc: number };
}

const pos = (i: number, R: number): { x: string; y: string } => {
  const a = ((-90 + i * 30) * Math.PI) / 180;
  return {
    x: (50 + R * Math.cos(a)).toFixed(2),
    y: (50 + R * Math.sin(a)).toFixed(2),
  };
};

/**
 * Contenu complet de la section Cercle des quintes pour une tonalité donnée.
 *
 * @param pcMaj hauteur de la tonalité majeure de référence (le secteur du cercle)
 * @param isMin la tonalité courante est la relative mineure de ce secteur
 */
export function circleVals(pcMaj: number, isMin: boolean): CircleVals {
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

  const mk = (
    i: number,
    R: number,
    label: string,
    sub: string,
    inKey: boolean,
    isTonic: boolean,
    target: { pc: number; min: boolean },
  ): CircleNode => {
    const o = pos(i, R);
    return {
      label,
      sub: inKey ? sub : '',
      x: o.x,
      y: o.y,
      isTonic,
      inKey: inKey && !isTonic,
      plain: !inKey && !isTonic,
      target,
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
        42.5,
        majOf(p),
        (d === 0 ? 'I' : d === 1 ? 'V' : 'IV') + ' · ' + (d === 1 ? '7' : 'maj7'),
        inK,
        !isMin && d === 0,
        asMaj,
      ),
    );
    circleMin.push(
      mk(
        i,
        29,
        minOf((p + 9) % 12) + 'm',
        (d === 0 ? 'vi' : d === 1 ? 'iii' : 'ii') + ' · m7',
        inK,
        isMin && d === 0,
        { pc: p, min: true },
      ),
    );
    circleDim.push(
      mk(i, 17, majOf(((i + 5) * 7) % 12) + '°', 'vii° · m7' + FLAT + '5', d === 0, false, asMaj),
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
    { title: 'Accords diatoniques', lines: chords(scale, pc, tonic) ?? [] },
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
    openTarget: { scaleId: isMin ? 'min' : 'maj', keyPc: pc },
  };
}
