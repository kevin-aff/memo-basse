import { useCallback, useEffect, useRef, useState } from 'react';
import { getCtx, scheduleClick } from '../audio/engine';
import { BEATS_PER_BAR } from './exercise';

/** Avance de planification sur l'horloge audio, en secondes. */
const LOOKAHEAD = 0.15;
/** Période du planificateur, en millisecondes. */
const TICK = 25;

export interface Metronome {
  running: boolean;
  /** temps courant dans la mesure, 0 à 3 ; -1 à l'arrêt */
  beat: number;
  toggle: () => void;
  stop: () => void;
}

/**
 * Métronome libre, indépendant de l'exercice : sert à se caler avant de lancer,
 * ou simplement à travailler au clic.
 *
 * Même principe que le séquenceur des gammes — les clics sont planifiés à l'avance
 * sur l'horloge de l'`AudioContext`, seul l'affichage suit `requestAnimationFrame`.
 */
export function useMetronome(tempo: number): Metronome {
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);

  const anchorTime = useRef(0);
  const anchorBeat = useRef(0);
  const spb = useRef(60 / tempo);
  const nextBeat = useRef(0);
  const timer = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

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
  };

  const stop = useCallback((): void => {
    clearAll();
    setRunning(false);
    setBeat(-1);
  }, []);

  const tick = (): void => {
    const ac = getCtx();
    if (!ac) return;
    while (beatTime(nextBeat.current) < ac.currentTime + LOOKAHEAD) {
      const b = nextBeat.current;
      scheduleClick(ac, b % BEATS_PER_BAR === 0, beatTime(b));
      nextBeat.current = b + 1;
    }
  };
  const tickRef = useRef(tick);
  tickRef.current = tick;

  const frame = (): void => {
    const ac = getCtx();
    if (ac) {
      const b = Math.floor((ac.currentTime - anchorTime.current) / spb.current) + anchorBeat.current;
      setBeat(((b % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR);
    }
    raf.current = window.requestAnimationFrame(() => frameRef.current());
  };
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const start = useCallback((): void => {
    const ac = getCtx();
    if (!ac) return;
    clearAll();
    spb.current = 60 / tempo;
    anchorTime.current = ac.currentTime + 0.12;
    anchorBeat.current = 0;
    nextBeat.current = 0;
    setBeat(0);
    setRunning(true);
    tickRef.current();
    timer.current = window.setInterval(() => tickRef.current(), TICK);
    raf.current = window.requestAnimationFrame(() => frameRef.current());
  }, [tempo]);

  const toggle = useCallback((): void => {
    if (timer.current !== null) stop();
    else start();
  }, [start, stop]);

  // Changement de tempo en marche : on rebase sur le premier temps non planifié,
  // pour ne pas décaler les clics déjà en file.
  useEffect(() => {
    if (timer.current === null) {
      spb.current = 60 / tempo;
      return;
    }
    const b = nextBeat.current;
    anchorTime.current = beatTime(b);
    anchorBeat.current = b;
    spb.current = 60 / tempo;
  }, [tempo]);

  useEffect(() => clearAll, []);

  return { running, beat, toggle, stop };
}
