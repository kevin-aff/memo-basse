/** Écart en degrés de gamme pour chaque motif d'intervalles brisés. */
export const MOTIF_STEP: Record<string, number> = { b3: 2, b4: 3, b5: 4, b6: 5, b7: 6 };

export interface Motif {
  id: string;
  nom: string;
  sub: string;
}

export const MOTIFS: Motif[] = [
  { id: 'lin', nom: 'Linéaire', sub: '1 2 3 4 5…' },
  { id: 'b3', nom: 'Tierces brisées', sub: '1 3 · 2 4 · 3 5…' },
  { id: 'b4', nom: 'Quartes brisées', sub: '1 4 · 2 5 · 3 6…' },
  { id: 'b5', nom: 'Quintes brisées', sub: '1 5 · 2 6 · 3 7…' },
  { id: 'b6', nom: 'Sixtes brisées', sub: '1 6 · 2 7 · 3 8…' },
  { id: 'b7', nom: 'Septièmes brisées', sub: '1 7 · 2 8 · 3 9…' },
  { id: 'triad', nom: 'Triades', sub: '1 3 5 3 1 · 2 4 6 4 2…' },
];

export function motifById(id: string): Motif {
  return MOTIFS.filter((m) => m.id === id)[0] ?? MOTIFS[0];
}

/** Nombre de notes d'extension nécessaires au motif, de part et d'autre du motif d'octave. */
export function motifExtra(motifId: string): number {
  if (motifId === 'triad') return 4;
  return MOTIF_STEP[motifId] ?? 0;
}

/**
 * Séquence d'un exercice : montée depuis la tonique jusqu'au motif partant de l'octave,
 * puis descente jusqu'au motif partant de la tonique. Une tonique de résolution est
 * ajoutée si la dernière note n'en est pas une.
 *
 * @param pool notes disponibles, triées du grave à l'aigu (extensions comprises)
 * @param i0   index de la tonique basse dans `pool`
 * @param iTop index de la tonique haute dans `pool`
 */
export function applyMotif<T>(pool: T[], motif: string, i0: number, iTop: number): T[] {
  const n = pool.length;
  const out: T[] = [];

  const linear = (): T[] => {
    const l: T[] = [];
    for (let i = i0; i <= iTop; i++) l.push(pool[i]);
    for (let i = iTop - 1; i >= i0; i--) l.push(pool[i]);
    return l;
  };

  if (motif === 'lin') return linear();

  if (motif === 'triad') {
    for (let i = i0; i <= iTop && i + 4 < n; i++) {
      [i, i + 2, i + 4, i + 2, i].forEach((j) => out.push(pool[j]));
    }
    for (let i = iTop; i >= i0 && i - 4 >= 0; i--) {
      [i, i - 2, i - 4, i - 2, i].forEach((j) => out.push(pool[j]));
    }
  } else {
    const k = MOTIF_STEP[motif] ?? 2;
    for (let i = i0; i <= iTop && i + k < n; i++) {
      out.push(pool[i]);
      out.push(pool[i + k]);
    }
    for (let i = iTop; i >= i0 && i - k >= 0; i--) {
      out.push(pool[i]);
      out.push(pool[i - k]);
    }
  }

  if (!out.length) return linear();
  if (out[out.length - 1] !== pool[i0]) out.push(pool[i0]);
  return out;
}
