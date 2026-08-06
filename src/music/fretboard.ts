import { FRET_MAX, OPEN_MIDI, STRING_A, STR_NAMES } from './constants';
import { scaleInfo } from './scales';
import { degLabel, spell } from './spelling';
import type { Cell, Fret, LabelMode, Pattern, PatternNote, Row, Scale } from './types';

/**
 * Motif d'une octave sur le manche, en coordonnées relatives à la fondamentale.
 *
 * Placement : `v ≤ 3` sur `rs`, `4–8` sur `rs-1`, `9–12` sur `rs-2`, au-delà sur `rs-3`.
 *
 * @param rs       index de corde de la fondamentale (2 = La, 3 = Mi)
 * @param extraUp  nombre de notes prolongeant la gamme au-dessus de l'octave
 * @param extraLow nombre de notes prolongeant la gamme sous la fondamentale
 * @param minOff   frette relative minimale acceptée pour les notes d'extension
 * @param maxOff   frette relative maximale acceptée pour les notes d'extension
 */
export function pattern(
  sc: Scale,
  rs: number = STRING_A,
  extraUp = 0,
  extraLow = 0,
  minOff: number | null = null,
  maxOff: number | null = null,
): Pattern {
  const raw: { v: number; d: number; base?: boolean }[] = sc.semis.map((v, i) => ({
    v,
    d: sc.degs[i],
    base: true,
  }));
  const n = sc.semis.length - 1;
  for (let j = 1; j <= extraUp && j <= n; j++) raw.push({ v: 12 + sc.semis[j], d: sc.degs[j] });
  for (let j = 1; j <= extraLow && j <= n; j++) raw.push({ v: sc.semis[n - j] - 12, d: sc.degs[n - j] });

  const notes: PatternNote[] = [];
  raw.forEach((x) => {
    let str =
      x.v < -1 ? rs + 1 : x.v <= 3 ? rs : x.v <= 8 ? rs - 1 : x.v <= 12 ? rs - 2 : rs - 3;
    if (str < 0) str = rs - 2;
    if (str > 3) str = rs;
    const off = x.v - (rs - str) * 5;
    // Les notes d'extension qui sortent du manche sont écartées ; jamais celles du motif.
    if (!x.base && minOff != null && off < minOff) return;
    if (!x.base && maxOff != null && off > maxOff) return;
    notes.push({ str, off, v: x.v, d: x.d });
  });

  const offs = notes.map((x) => x.off);
  const nmin = Math.min.apply(null, offs);
  const nmax = Math.max.apply(null, offs);
  let start = nmin - 1;
  let end = nmax;
  while (end - start + 1 < 5) end++;
  return { notes, start, end, nmin, nmax };
}

/**
 * Frette de la fondamentale. Remonte d'une octave si le motif tomberait sous la frette 1.
 * Le calcul ignore volontairement l'extension basse (`extraLow = 0`) : sinon la position saute.
 */
export function rootFret(sc: Scale, pc: number, rs: number = STRING_A, extra = 0): number {
  const openPc = rs === STRING_A ? 9 : 4;
  let f = (((pc - openPc) % 12) + 12) % 12;
  if (f === 0) f = 12;
  const p = pattern(sc, rs, extra, 0);
  if (f + p.start < 1) f += 12;
  return f;
}

export interface RowsOptions {
  mode: LabelMode;
  /** notation des degrés en chiffres plutôt qu'en symboles */
  num?: boolean;
  /** hauteur de la tonique, requis en mode `note` */
  pc?: number;
  /** tonique orthographiée, requise en mode `note` */
  tonic?: string;
  /** frette de la fondamentale — sert à numéroter les frettes et à borner les extensions */
  rootFret?: number | null;
  rs?: number;
  /** afficher toutes les notes de la position plutôt que le seul motif */
  full?: boolean;
  extra?: number;
}

export interface RowsResult {
  rows: Row[];
  frets: Fret[];
  p: Pattern;
}

/**
 * Grille du diagramme : 4 cordes × fenêtre de frettes.
 * Hors mode `full`, les notes de la gamme situées hors du motif sur la corde voisine
 * sont rendues en translucide (`isGhost` / `isGhostRoot`).
 */
export function buildRows(sc: Scale, opt: RowsOptions): RowsResult {
  const rs = opt.rs ?? STRING_A;
  // Corde portant les notes translucides : Mi quand la fondamentale est sur La, Sol sinon.
  const gs = rs === STRING_A ? 3 : 0;
  const inf = scaleInfo(sc);
  const lo = opt.rootFret != null ? -opt.rootFret : null;
  const hi = opt.rootFret != null ? FRET_MAX - opt.rootFret : null;
  const p = pattern(sc, rs, opt.extra ?? 0, opt.extra ?? 0, lo, hi);

  const label = (d: number, v: number): string =>
    opt.mode === 'note'
      ? spell(opt.tonic ?? 'C', d, (opt.pc ?? 0) + v)
      : degLabel(d, v, !!opt.num);

  const rows: Row[] = [];
  for (let s = 0; s < 4; s++) {
    const cells: Cell[] = [];
    for (let o = p.start; o <= p.end; o++) {
      if (opt.full) {
        const iv = ((((OPEN_MIDI[s] + o) - OPEN_MIDI[rs]) % 12) + 12) % 12;
        const g = inf[iv];
        const isRoot = !!g && iv === 0;
        cells.push({
          label: g ? label(g.d, g.v) : '',
          isNote: !!g && !isRoot,
          isRoot,
          isGhost: false,
          isGhostRoot: false,
        });
        continue;
      }
      const n = p.notes.filter((x) => x.str === s && x.off === o)[0];
      const cell: Cell = {
        label: '',
        isNote: false,
        isRoot: false,
        isGhost: false,
        isGhostRoot: false,
      };
      if (n) {
        cell.isRoot = n.v % 12 === 0;
        cell.isNote = !cell.isRoot;
        cell.label = label(n.d, n.v);
      } else if (s === gs) {
        const semi = (((o + (rs - s) * 5) % 12) + 12) % 12;
        const g = inf[semi];
        if (g) {
          cell.isGhostRoot = semi === 0;
          cell.isGhost = !cell.isGhostRoot;
          cell.label = label(g.d, g.v);
        }
      }
      cells.push(cell);
    }
    rows.push({ name: STR_NAMES[s], cells });
  }

  const frets: Fret[] = [];
  for (let o = p.start; o <= p.end; o++) {
    frets.push({ n: opt.rootFret != null ? String(opt.rootFret + o) : '' });
  }
  return { rows, frets, p };
}
