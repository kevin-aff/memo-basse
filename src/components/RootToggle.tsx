import { STRING_A, STRING_E } from '../music/constants';
import { cx } from './ui';

const ROOTS = [
  { rs: STRING_A, label: 'Fondamentale corde La' },
  { rs: STRING_E, label: 'Fondamentale corde Mi' },
];

/** Choix de la corde portant la fondamentale du motif. */
export function RootToggle({
  rs,
  onChange,
  small = false,
}: {
  rs: number;
  onChange: (rs: number) => void;
  small?: boolean;
}) {
  return (
    <div
      className={cx('segmented', small && 'segmented--sm')}
      role="group"
      aria-label="Corde de la fondamentale"
    >
      {ROOTS.map((r) => (
        <button
          key={r.rs}
          type="button"
          className={cx('seg', small && 'seg--sm', rs === r.rs && 'is-on')}
          aria-pressed={rs === r.rs}
          onClick={() => onChange(r.rs)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
