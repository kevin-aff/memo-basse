import type { TabSystem } from '../music/training';
import { cx } from './ui';

const STRINGS = [0, 1, 2, 3];

/**
 * Tablature de l'exercice : 4 mesures par système, barre de mesure fine toutes
 * les 4 notes, double barre à chaque extrémité. Le dernier système est complété
 * à la mesure près et mis à l'échelle.
 */
export function TabStaff({
  systems,
  activeStep,
  label,
}: {
  systems: TabSystem[];
  activeStep: number | null;
  label: string;
}) {
  return (
    <div className="tab__systems" role="img" aria-label={label}>
      {systems.map((sys, si) => (
        <div className="tab__sys" key={si} style={{ minWidth: sys.minw }}>
          <div className="tab__clef" aria-hidden="true">
            <span>T</span>
            <span>A</span>
            <span>B</span>
          </div>
          <div className="tab__meter" aria-hidden="true">
            <span>4</span>
            <span>4</span>
          </div>
          <div className="tab__staff" style={{ flexBasis: sys.width }}>
            {sys.cols.map((col, ci) => (
              <div className="tab__col" key={ci}>
                {col.bar ? <span className="tab__bar" /> : null}
                {STRINGS.map((s) => (
                  <div className="tab__cell" key={s}>
                    <span className="tab__line" />
                    {col.step !== null && col.str === s ? (
                      <span className={cx('tab__n', activeStep === col.step && 'is-active')}>
                        {col.n}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
