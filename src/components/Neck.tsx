import { STR_NAMES_FR } from '../music/constants';
import type { Fret } from '../music/types';
import type { NeckCell, NeckRow } from '../music/scaleView';
import { cx } from './ui';

function NeckDot({ cell }: { cell: NeckCell }) {
  if (!cell.isNote && !cell.isRoot) return null;
  return (
    <span className={cx('dot', 'dot--neck', cell.isRoot ? 'dot--root' : 'dot--note')}>
      {cell.label}
    </span>
  );
}

function neckLabel(rows: NeckRow[]): string {
  const parts = rows.map((row) => {
    const notes: string[] = [];
    if (row.open.isNote || row.open.isRoot) notes.push(row.open.label + ' à vide');
    row.cells.forEach((c, i) => {
      if (c.isNote || c.isRoot) notes.push(c.label + ' frette ' + (i + 1));
    });
    const name = STR_NAMES_FR[row.name] ?? row.name;
    return `corde de ${name} : ${notes.join(', ')}`;
  });
  return `Manche complet, frettes 0 à 19. ${parts.join(' ; ')}.`;
}

/** Manche complet 0–19 : sillet épais, notes de la gamme, cases du motif surlignées. */
export function Neck({ rows, frets }: { rows: NeckRow[]; frets: Fret[] }) {
  return (
    <div className="scroll-x">
      <div className="neck" role="img" aria-label={neckLabel(rows)}>
        <div className="neck__labels">
          {rows.map((row) => (
            <div className="neck__label" key={row.name}>
              {row.name}
            </div>
          ))}
        </div>

        <div className="neck__open">
          {rows.map((row) => (
            <div className="neck__cellbox" key={row.name}>
              {row.open.inPos ? <span className="neck__pos" /> : null}
              <span className="neck__string" />
              <NeckDot cell={row.open} />
            </div>
          ))}
          <div className="neck__pad" />
        </div>

        <div className="neck__grid">
          {rows.map((row) => (
            <div className="neck__row" key={row.name}>
              {row.cells.map((cell, i) => (
                <div className="neck__cell" key={i}>
                  {cell.inPos ? <span className="neck__pos" /> : null}
                  <span className="neck__string" />
                  <NeckDot cell={cell} />
                </div>
              ))}
            </div>
          ))}
          <div className="neck__frets">
            {frets.map((f, i) => (
              <div className="neck__fret" key={i}>
                {f.n}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
