import { useMemo } from 'react';
import { BackButton, PanelCard, cx } from '../components/ui';
import { circleVals } from '../music/circle';
import type { CircleNode } from '../music/circle';
import type { ScaleId } from '../music/types';

type Ring = 'maj' | 'min' | 'dim';

const RING_SIZE: Record<Ring, string> = { maj: '15%', min: '12%', dim: '8.5%' };

function Node({
  node,
  ring,
  onPick,
}: {
  node: CircleNode;
  ring: Ring;
  onPick: (pc: number, min: boolean) => void;
}) {
  const size = RING_SIZE[ring];
  const state = node.isTonic ? 'is-tonic' : node.inKey ? 'is-inkey' : 'is-plain';
  return (
    <button
      type="button"
      className={cx('circle-node', `circle-node--${ring}`, state)}
      style={{ left: node.x + '%', top: node.y + '%', width: size, height: size }}
      aria-pressed={node.isTonic}
      onClick={() => onPick(node.target.pc, node.target.min)}
    >
      <span className="circle-node__label">{node.label}</span>
      {node.sub ? <span className="circle-node__sub">{ring === 'dim' ? 'vii°' : node.sub}</span> : null}
    </button>
  );
}

export function CircleView({
  cPc,
  cMin,
  onPick,
  onOpenInScales,
  onBack,
}: {
  cPc: number;
  cMin: boolean;
  onPick: (pc: number, min: boolean) => void;
  onOpenInScales: (scaleId: ScaleId, keyPc: number) => void;
  onBack: () => void;
}) {
  const v = useMemo(() => circleVals(cPc, cMin), [cPc, cMin]);

  return (
    <div className="view">
      <div className="view__bar">
        <BackButton label="← Menu" onClick={onBack} />
        <h2 className="view__title">Cercle des quintes</h2>
      </div>

      <div className="circle-layout">
        <section className="card card--pad circle-card">
          <h3 className="eyebrow">
            Majeurs · mineurs · diminué — la fenêtre en rouge est la tonalité
          </h3>

          <div className="circle-wrap">
            <div className="circle-center">
              <span className="circle-center__tonic">{v.cTonic}</span>
              <span className="circle-center__sig">{v.cSigShort}</span>
            </div>
            {v.circleMaj.map((n, i) => (
              <Node key={'M' + i} node={n} ring="maj" onPick={onPick} />
            ))}
            {v.circleMin.map((n, i) => (
              <Node key={'m' + i} node={n} ring="min" onPick={onPick} />
            ))}
            {v.circleDim.map((n, i) => (
              <Node key={'d' + i} node={n} ring="dim" onPick={onPick} />
            ))}
          </div>

          <button
            type="button"
            className="btn btn--primary circle-cta"
            onClick={() => onOpenInScales(v.openTarget.scaleId, v.openTarget.keyPc)}
          >
            Travailler {v.cTonic} dans Gammes →
          </button>
        </section>

        <div className="circle-panels">
          {v.cPanels.map((p) => (
            <PanelCard key={p.title} panel={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
