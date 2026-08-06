import { FLAT, SHARP } from './constants';
import { spell } from './spelling';
import type { ModeScale, Scale, ScaleId } from './types';

export const SCALES: Scale[] = [
  { id: 'maj', nom: 'Majeure', semis: [0, 2, 4, 5, 7, 9, 11, 12], degs: [1, 2, 3, 4, 5, 6, 7, 1] },
  { id: 'min', nom: 'Mineure naturelle', semis: [0, 2, 3, 5, 7, 8, 10, 12], degs: [1, 2, 3, 4, 5, 6, 7, 1] },
  { id: 'pmaj', nom: 'Pentatonique majeure', semis: [0, 2, 4, 7, 9, 12], degs: [1, 2, 3, 5, 6, 1] },
  { id: 'pmin', nom: 'Pentatonique mineure', semis: [0, 3, 5, 7, 10, 12], degs: [1, 3, 4, 5, 7, 1] },
  { id: 'bmin', nom: 'Blues mineure', semis: [0, 3, 5, 6, 7, 10, 12], degs: [1, 3, 4, 5, 5, 7, 1] },
  { id: 'bmaj', nom: 'Blues majeure', semis: [0, 2, 3, 4, 7, 9, 12], degs: [1, 2, 3, 3, 5, 6, 1] },
  { id: 'harm', nom: 'Mineure harmonique', semis: [0, 2, 3, 5, 7, 8, 11, 12], degs: [1, 2, 3, 4, 5, 6, 7, 1] },
  { id: 'mel', nom: 'Mineure mélodique', semis: [0, 2, 3, 5, 7, 9, 11, 12], degs: [1, 2, 3, 4, 5, 6, 7, 1] },
];

/** Noms des modes par gamme mère. Les gammes absentes n'ont pas de modes. */
export const MODE_NAMES: Partial<Record<ScaleId, string[]>> = {
  maj: ['Ionien', 'Dorien', 'Phrygien', 'Lydien', 'Mixolydien', 'Éolien', 'Locrien'],
  min: ['Éolien', 'Locrien', 'Ionien', 'Dorien', 'Phrygien', 'Lydien', 'Mixolydien'],
  harm: [
    'Mineure harmonique',
    'Locrien ♮6',
    'Ionien ' + SHARP + '5',
    'Dorien ' + SHARP + '4',
    'Phrygien dominant',
    'Lydien ' + SHARP + '2',
    'Altérée dim.',
  ],
  mel: [
    'Mineure mélodique',
    'Dorien ' + FLAT + '2',
    'Lydien augmenté',
    'Lydien dominant',
    'Mixolydien ' + FLAT + '6',
    'Locrien ♮2',
    'Altérée (super-locrien)',
  ],
  pmaj: ['Majeure', 'Égyptienne / sus', 'Man gong', 'Ritusen', 'Mineure'],
  pmin: ['Mineure', 'Majeure', 'Égyptienne / sus', 'Man gong', 'Ritusen'],
};

export function scaleById(id: ScaleId | string): Scale {
  return SCALES.filter((s) => s.id === id)[0] ?? SCALES[0];
}

export function modeNames(id: ScaleId): string[] | undefined {
  return MODE_NAMES[id];
}

/**
 * Table hauteur (0-11) → première note de la gamme correspondante.
 * Sert à savoir si une case du manche appartient à la gamme, et sous quel degré.
 */
export function scaleInfo(sc: Scale): Record<number, { v: number; d: number }> {
  const m: Record<number, { v: number; d: number }> = {};
  sc.semis.forEach((v, i) => {
    const p = v % 12;
    if (m[p] === undefined) m[p] = { v, d: sc.degs[i] };
  });
  return m;
}

/**
 * Rotation d'une gamme sur son i-ème degré : renvoie la gamme du mode,
 * sa tonique orthographiée et son nom.
 */
export function modeScale(
  parent: Scale,
  parentTonic: string,
  keyPc: number,
  mi: number,
): ModeScale {
  const names = MODE_NAMES[parent.id];
  if (!mi) {
    return {
      sc: parent,
      pc: keyPc,
      tonic: parentTonic,
      name: names ? names[0] : parent.nom,
    };
  }
  const n = parent.semis.length - 1;
  const s = parent.semis.slice(0, n);
  const pd = parent.degs.slice(0, n);
  const semis: number[] = [];
  const degs: number[] = [];
  for (let k = 0; k < n; k++) {
    semis.push((((s[(mi + k) % n] - s[mi]) % 12) + 12) % 12);
    degs.push(((pd[(mi + k) % n] - pd[mi] + 7) % 7) + 1);
  }
  semis.push(12);
  degs.push(1);
  const pc = (keyPc + s[mi]) % 12;
  return {
    sc: { id: parent.id, nom: parent.nom, semis, degs },
    pc,
    tonic: spell(parentTonic, pd[mi], pc),
    name: names ? names[mi] : parent.nom,
  };
}

/** Formule de la gamme en tons : `1  –  ½  –  1…` */
export function formula(sc: Scale): string {
  const t: string[] = [];
  for (let i = 1; i < sc.semis.length; i++) {
    const d = sc.semis[i] - sc.semis[i - 1];
    t.push(d === 1 ? '½' : d === 2 ? '1' : d === 3 ? '1½' : String(d / 2));
  }
  return t.join('  –  ');
}
