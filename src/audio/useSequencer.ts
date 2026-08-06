import { useCallback, useEffect, useRef, useState } from 'react';
import { getCtx, scheduleClick, scheduleTone } from './engine';

/** Avance de planification sur l'horloge audio, en secondes. */
const LOOKAHEAD = 0.15;
/** Période du planificateur, en millisecondes. */
const TICK = 25;

export interface SequencerOptions {
  /** hauteurs MIDI à jouer, une par temps */
  midis: number[];
  tempo: number;
  loop: boolean;
  sound: 'notes' | 'click';
}

export interface Sequencer {
  running: boolean;
  /** index de la note en cours ; 0 à l'arrêt */
  index: number;
  start: () => void;
  stop: () => void;
}

/**
 * Séquenceur à lookahead : les notes sont planifiées à l'avance sur l'horloge de
 * l'`AudioContext`, seul l'affichage suit `requestAnimationFrame`. Le tempo reste
 * stable même quand l'onglet ralentit les timers.
 */
export function useSequencer(opts: SequencerOptions): Sequencer {
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const anchorTime = useRef(0);
  const anchorBeat = useRef(0);
  const spb = useRef(60 / opts.tempo);
  const nextBeat = useRef(0);
  const timer = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const endTimer = useRef<number | null>(null);

  const beatTime = (b: number): number =>
    anchorTime.current + (b - anchorBeat.current) * spb.current;

  const clearAll = (): void => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    if (raf.current !== null) {
      window.cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    if (endTimer.current !== null) {
      window.clearTimeout(endTimer.current);
      endTimer.current = null;
    }
  };

  const stop = useCallback((): void => {
    clearAll();
    setRunning(false);
    setIndex(0);
  }, []);

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const tick = (): void => {
    const ac = getCtx();
    if (!ac) return;
    const { midis, loop, sound } = optsRef.current;
    const n = midis.length;
    if (!n) {
      stopRef.current();
      return;
    }
    const horizon = ac.currentTime + LOOKAHEAD;
    while (beatTime(nextBeat.current) < horizon) {
      const b = nextBeat.current;
      if (!loop && b >= n) {
        // Séquence terminée : on laisse sonner la dernière note puis on arrête.
        if (timer.current !== null) {
          window.clearInterval(timer.current);
          timer.current = null;
        }
        const wait = Math.max(0, (beatTime(n) - ac.currentTime) * 1000);
        endTimer.current = window.setTimeout(() => stopRef.current(), wait);
        return;
      }
      const i = b % n;
      const t = beatTime(b);
      if (sound === 'click') scheduleClick(ac, i % 4 === 0, t);
      else scheduleTone(ac, midis[i], t, Math.min(0.9, spb.current * 0.9));
      nextBeat.current = b + 1;
    }
  };
  const tickRef = useRef(tick);
  tickRef.current = tick;

  const frame = (): void => {
    const ac = getCtx();
    const { midis, loop } = optsRef.current;
    const n = midis.length;
    if (ac && n) {
      const b =
        Math.floor((ac.currentTime - anchorTime.current) / spb.current) + anchorBeat.current;
      const bb = Math.max(0, b);
      setIndex(loop ? bb % n : Math.min(bb, n - 1));
    }
    raf.current = window.requestAnimationFrame(() => frameRef.current());
  };
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const start = useCallback((): void => {
    const ac = getCtx();
    if (!ac || !optsRef.current.midis.length) return;
    clearAll();
    spb.current = 60 / optsRef.current.tempo;
    anchorTime.current = ac.currentTime + 0.12;
    anchorBeat.current = 0;
    nextBeat.current = 0;
    setIndex(0);
    setRunning(true);
    tickRef.current();
    timer.current = window.setInterval(() => tickRef.current(), TICK);
    raf.current = window.requestAnimationFrame(() => frameRef.current());
  }, []);

  // Changement de tempo en cours de lecture : on rebase l'ancre sur le premier
  // temps non encore planifié, pour ne pas décaler les notes déjà en file.
  useEffect(() => {
    if (timer.current === null) {
      spb.current = 60 / opts.tempo;
      return;
    }
    const b = nextBeat.current;
    anchorTime.current = beatTime(b);
    anchorBeat.current = b;
    spb.current = 60 / opts.tempo;
  }, [opts.tempo]);

  useEffect(() => clearAll, []);

  return { running, index, start, stop };
}
