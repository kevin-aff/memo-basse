import { STR_NAMES_FR } from '../music/constants';
import type { Cell, Fret, Row } from '../music/types';
import { Dot, cx } from './ui';

/**
 * Description textuelle du diagramme, pour les lecteurs d'écran :
 * le diagramme lui-même est purement visuel.
 */
export function fretboardLabel(rows: Row[], frets: Fret[] | undefined, prefix: string): string {
  const parts = rows.map((row) => {
    const notes = row.cells
      .map((c, i) => {
        if (!c.isNote && !c.isRoot && !c.isPlay) return null;
        const fret = frets?.[i]?.n;
        return c.label + (fret ? ' frette ' + fret : '');
      })
      .filter((x): x is string => x !== null);
    const name = STR_NAMES_FR[row.name] ?? row.name;
    return `corde de ${name} : ${notes.length ? notes.join(', ') : 'aucune note'}`;
  });
  return `${prefix}. ${parts.join(' ; ')}.`;
}

export interface FretboardProps {
  rows: Row[];
  /** numéros de frettes sous la grille ; omis dans les vignettes de l'index */
  frets?: Fret[];
  /** colonne « sillet », rendue à gauche avec une bordure épaisse */
  nut?: Cell[] | null;
  size?: 'lg' | 'sm';
  /** colonnes de largeur fixe (46 px) plutôt qu'élastiques */
  fixed?: boolean;
  minWidth?: string;
  scroll?: boolean;
  label: string;
}

export function Fretboard({
  rows,
  frets,
  nut,
  size = 'lg',
  fixed = false,
  minWidth,
  scroll = false,
  label,
}: FretboardProps) {
  const small = size === 'sm';
  const board = (
    <div
      className={cx('fb', small && 'fb--sm', fixed && 'fb--fixed')}
      style={minWidth ? { minWidth } : undefined}
      role="img"
      aria-label={label}
    >
      <div className="fb__labels">
        {rows.map((row) => (
          <div className="fb__label" key={row.name}>
            {row.name}
          </div>
        ))}
      </div>

      {nut && nut.length ? (
        <div className="fb__nut">
          {nut.map((cell, i) => (
            <div className="fb__cellbox" key={i}>
              <span className="fb__string" />
              <Dot cell={cell} small={small} />
            </div>
          ))}
          <div className="fb__nut-pad" />
        </div>
      ) : null}

      <div className="fb__grid">
        {rows.map((row) => (
          <div className="fb__row" key={row.name}>
            {row.cells.map((cell, i) => (
              <div className="fb__cell" key={i}>
                <span className="fb__string" />
                <Dot cell={cell} small={small} />
              </div>
            ))}
          </div>
        ))}
        {frets ? (
          <div className="fb__frets">
            {frets.map((f, i) => (
              <div className="fb__fret" key={i}>
                {f.n}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  return scroll ? <div className="scroll-x">{board}</div> : board;
}
