import { useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { playChord } from '../audio/engine';
import type { CircleSound } from '../audio/engine';
import { BackButton, PanelCard, cx } from '../components/ui';
import { DEGREE_NUM } from '../config';
import { HUB_R, circleVals } from '../music/circle';
import type { CircleNode, Ring } from '../music/circle';
import type { ScaleId } from '../music/types';

const SOUND_MODES: { id: CircleSound; label: string }[] = [
  { id: 'note', label: 'Note seule' },
  { id: 'arp', label: 'Arpège' },
  { id: 'chord', label: 'Accord plaqué' },
];

const CHORD_SIZES: { sev: boolean; label: string }[] = [
  { sev: false, label: 'Triades · 3 notes' },
  { sev: true, label: 'Tétrades · 4 notes' },
];

const state = (n: CircleNode): string =>
  n.isTonic ? 'is-tonic' : n.inKey ? 'is-inkey' : 'is-plain';

export interface CircleViewProps {
  cPc: number;
  cMin: boolean;
  cSound: CircleSound;
  cSev: boolean;
  cLock: boolean;
  onPick: (pc: number, min: boolean) => void;
  onSound: (s: CircleSound) => void;
  onSev: (sev: boolean) => void;
  onLock: (locked: boolean) => void;
  onPickAndLock: (pc: number, min: boolean) => void;
  onOpenInScales: (scaleId: ScaleId, keyPc: number) => void;
  onBack: () => void;
}

export function CircleView(props: CircleViewProps) {
  const { cPc, cMin, cSound, cSev, cLock } = props;
  const v = useMemo(() => circleVals(cPc, cMin, cSev, DEGREE_NUM), [cPc, cMin, cSev]);

  const rings: { ring: Ring; nodes: CircleNode[] }[] = [
    { ring: 'maj', nodes: v.circleMaj },
    { ring: 'min', nodes: v.circleMin },
    { ring: 'dim', nodes: v.circleDim },
  ];

  /** Clic : jouer l'accord, et sélectionner la tonalité tant qu'elle n'est pas figée. */
  const hit = (n: CircleNode): void => {
    playChord(n.rootPc, n.quality, v.basePc, cSound, cSev);
    if (!cLock) props.onPick(n.target.pc, n.target.min);
  };

  /** Double-clic : sélectionner puis figer, quel que soit l'état courant. */
  const lockOn = (n: CircleNode): void => props.onPickAndLock(n.target.pc, n.target.min);

  const onKey = (e: KeyboardEvent<SVGPathElement>, n: CircleNode): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    hit(n);
  };

  return (
    <div className="view">
      <div className="view__bar">
        <BackButton label="← Menu" onClick={props.onBack} />
        <h2 className="view__title">Cercle des quintes</h2>
      </div>

      <div className="circle-layout">
        <section className="card card--pad circle-card">
          <h3 className="eyebrow">
            Majeurs · mineurs · diminué — la fenêtre en rouge est la tonalité · clic = écouter,
            double-clic = figer la tonalité
          </h3>

          <div className="segmented segmented--onbg circle-modes" role="group" aria-label="Rendu sonore">
            {SOUND_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cx('seg', 'seg--md', cSound === m.id && 'is-on')}
                aria-pressed={cSound === m.id}
                onClick={() => props.onSound(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="circle-wrap">
            <svg viewBox="0 0 100 100" className="circle-svg">
              {rings.map(({ ring, nodes }) =>
                nodes.map((n, i) => (
                  <path
                    key={ring + i}
                    d={n.d}
                    className={cx('wedge', `wedge--${ring}`, state(n))}
                    role="button"
                    tabIndex={0}
                    aria-label={`${n.label}${n.sub ? ', ' + n.sub : ''}`}
                    aria-pressed={n.isTonic}
                    onClick={() => hit(n)}
                    onDoubleClick={() => lockOn(n)}
                    onKeyDown={(e) => onKey(e, n)}
                    // Empêche la prise de focus à la souris : sinon le dernier secteur
                    // cliqué garde l'anneau de focus du navigateur. La tabulation, elle,
                    // focalise toujours et reçoit son propre indicateur.
                    onMouseDown={(e) => e.preventDefault()}
                  />
                )),
              )}
              <circle cx="50" cy="50" r={HUB_R} className="circle-hub" />
            </svg>

            {/* Libellés en HTML superposé plutôt qu'en <text> SVG : la typo reste nette
                à toute taille et suit l'échelle du reste de l'interface. */}
            {rings.map(({ ring, nodes }) =>
              nodes.map((n, i) => (
                <div
                  key={ring + i}
                  className={cx('circle-label', `circle-label--${ring}`, state(n))}
                  style={{ left: n.lx + '%', top: n.ly + '%' }}
                  aria-hidden="true"
                >
                  <span className="circle-label__name">{n.label}</span>
                  {n.sub ? <span className="circle-label__sub">{n.sub}</span> : null}
                </div>
              )),
            )}

            <div className="circle-center" aria-hidden="true">
              <span className="circle-center__tonic">{v.cTonic}</span>
              <span className="circle-center__sig">{v.cSigShort}</span>
            </div>
          </div>

          <button
            type="button"
            className={cx('lock-btn', cLock && 'is-on')}
            aria-pressed={cLock}
            onClick={() => props.onLock(!cLock)}
          >
            {cLock
              ? `◉ Tonalité figée sur ${v.cTonic} — déverrouiller`
              : `○ Figer la tonalité sur ${v.cTonic}`}
          </button>

          <button
            type="button"
            className="btn btn--primary circle-cta"
            onClick={() => props.onOpenInScales(v.openTarget.scaleId, v.openTarget.keyPc)}
          >
            Travailler {v.cTonic} dans Gammes →
          </button>
        </section>

        <div className="circle-panels">
          {v.cPanels.map((p) => (
            <PanelCard key={p.title} panel={p}>
              {p.table ? (
                <div
                  className="segmented segmented--onbg chord-switch"
                  role="group"
                  aria-label="Taille des accords"
                >
                  {CHORD_SIZES.map((o) => (
                    <button
                      key={String(o.sev)}
                      type="button"
                      className={cx('seg', 'seg--xs', cSev === o.sev && 'is-on')}
                      aria-pressed={cSev === o.sev}
                      onClick={() => props.onSev(o.sev)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </PanelCard>
          ))}
        </div>
      </div>
    </div>
  );
}
