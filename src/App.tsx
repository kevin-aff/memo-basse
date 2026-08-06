import { useCallback, useEffect, useState } from 'react';
import { Header } from './components/Header';
import { CircleView } from './views/CircleView';
import { MenuView } from './views/MenuView';
import { ScaleView } from './views/ScaleView';
import { ScalesIndexView } from './views/ScalesIndexView';
import { TrainView } from './views/TrainView';
import { loadState, saveState } from './state/appState';
import type { AppState } from './state/appState';

export default function App() {
  const [state, setState] = useState<AppState>(loadState);

  const patch = useCallback((p: Partial<AppState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  return (
    <div className="shell">
      <Header theme={state.theme} onTheme={(theme) => patch({ theme })} />

      {state.view === 'menu' ? <MenuView onOpen={(view) => patch({ view })} /> : null}

      {state.view === 'home' ? (
        <ScalesIndexView
          rs={state.rs}
          onRs={(rs) => patch({ rs })}
          onOpen={(scaleId) => patch({ view: 'scale', scaleId, mode: 0 })}
          onBack={() => patch({ view: 'menu' })}
        />
      ) : null}

      {state.view === 'scale' ? (
        <ScaleView
          scaleId={state.scaleId}
          keyPc={state.keyPc}
          mode={state.mode}
          rs={state.rs}
          labels={state.labels}
          onKey={(keyPc) => patch({ keyPc })}
          onMode={(mode) => patch({ mode })}
          onRs={(rs) => patch({ rs })}
          onLabels={(labels) => patch({ labels })}
          onBack={() => patch({ view: 'home' })}
        />
      ) : null}

      {state.view === 'cercle' ? (
        <CircleView
          cPc={state.cPc}
          cMin={state.cMin}
          cSound={state.cSound}
          cSev={state.cSev}
          cLock={state.cLock}
          onPick={(cPc, cMin) => patch({ cPc, cMin })}
          onPickAndLock={(cPc, cMin) => patch({ cPc, cMin, cLock: true })}
          onSound={(cSound) => patch({ cSound })}
          onSev={(cSev) => patch({ cSev })}
          onLock={(cLock) => patch({ cLock })}
          onOpenInScales={(scaleId, keyPc) =>
            patch({ view: 'scale', scaleId, keyPc, mode: 0 })
          }
          onBack={() => patch({ view: 'menu' })}
        />
      ) : null}

      {state.view === 'train' ? (
        <TrainView state={state} patch={patch} onBack={() => patch({ view: 'menu' })} />
      ) : null}
    </div>
  );
}
