import type { CSSProperties, ReactNode } from 'react';
import type { Cell, Panel as PanelData } from '../music/types';

export const cx = (...c: (string | false | null | undefined)[]): string =>
  c.filter(Boolean).join(' ');

/** Grille `auto-fit` paramétrable par la largeur minimale des colonnes. */
export function gridStyle(min: string, gap = '8px'): CSSProperties {
  return { '--grid-min': min, '--grid-gap': gap } as CSSProperties;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <Eyebrow>{label}</Eyebrow>
      {children}
    </div>
  );
}

export function OptionGrid({
  label,
  min,
  gap,
  children,
}: {
  label: string;
  min: string;
  gap?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid" role="group" aria-label={label} style={gridStyle(min, gap)}>
      {children}
    </div>
  );
}

export function Dot({ cell, small }: { cell: Cell; small?: boolean }) {
  const kind = cell.isPlay
    ? 'dot--play'
    : cell.isRoot
      ? 'dot--root'
      : cell.isNote
        ? 'dot--note'
        : cell.isGhostRoot
          ? 'dot--ghost-root'
          : cell.isGhost
            ? 'dot--ghost'
            : null;
  if (!kind) return null;
  return <span className={cx('dot', kind, small && 'dot--sm')}>{cell.label}</span>;
}

/** Tableau des accords diatoniques : N° · Accord · Notes · Degrés. */
function ChordTable({ rows }: { rows: NonNullable<PanelData['table']> }) {
  return (
    <div className="chord-table" role="table" aria-label="Accords diatoniques">
      <div className="chord-table__head" role="row">
        <span role="columnheader">N°</span>
        <span role="columnheader">Accord</span>
        <span role="columnheader">Notes</span>
        <span role="columnheader">Degrés</span>
      </div>
      {rows.map((r) => (
        <div className="chord-table__row" role="row" key={r.rn}>
          <span className="chord-table__rn" role="cell">
            {r.rn}
          </span>
          <span className="chord-table__acc" role="cell">
            {r.acc}
          </span>
          <span className="chord-table__notes" role="cell">
            {r.notes}
          </span>
          <span className="chord-table__degs" role="cell">
            {r.degs}
          </span>
        </div>
      ))}
    </div>
  );
}

/** `children` s'insère entre le grand libellé et le contenu (switch de la fiche accords). */
export function PanelCard({ panel, children }: { panel: PanelData; children?: ReactNode }) {
  return (
    <section className="panel">
      <h3 className="eyebrow panel__title">{panel.title}</h3>
      {panel.big ? <div className="panel__big">{panel.big}</div> : null}
      {children}
      {panel.table ? <ChordTable rows={panel.table} /> : null}
      {panel.lines.map((l, i) => (
        <div className="panel__line" key={l.l + i}>
          <span className="panel__line-l">{l.l}</span>
          <span className="panel__line-v">{l.v}</span>
        </div>
      ))}
    </section>
  );
}

export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn btn--back" onClick={onClick}>
      {label}
    </button>
  );
}
