import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCtx, scheduleClick } from '../audio/engine';
import {
  BEATS_PER_BAR,
  COUNT_IN_BEATS,
  buildGrid,
  scoreRun,
  totalBeats,
} from './exercise';
import type { ExpectedNote, Score } from './exercise';

interface RunData {
  grid: ExpectedNote[];
  expectedTimes: number[];
  detections: number[];
  spb: number;
}

export interface RhythmSession {
  running: boolean;
  /** position en temps ; négative pendant le décompte */
  position: number;
  score: Score | null;
  grid: ExpectedNote[];
  /** écart signé médian de la dernière session, avant correction de latence */
  rawMedianMs: number | null;
  start: () => void;
  stop: () => void;
  clear: () => void;
  /** à brancher sur la détection d'attaques de l'entrée */
  pushOnset: (time: number) => void;
}

export function useRhythmSession({
  tempo,
  offBeat,
  latencyMs,
}: {
  tempo: number;
  offBeat: boolean;
  latencyMs: number;
}): RhythmSession {
  const [running, setRunning] = useState(false);
  const [position, setPosition] = useState(-COUNT_IN_BEATS);
  const [run, setRun] = useState<RunData | null>(null);

  const runningRef = useRef(false);
  const detections = useRef<number[]>([]);
  const anchor = useRef(0);
  const spb = useRef(60 / tempo);
  const raf = useRef<number | null>(null);
  const endTimer = useRef<number | null>(null);
  const pending = useRef<RunData | null>(null);

  const grid = useMemo(() => buildGrid(offBeat), [offBeat]);

  const cleanup = (): void => {
    if (raf.current !== null) {
      window.cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    if (endTimer.current !== null) {
      window.clearTimeout(endTimer.current);
      endTimer.current = null;
    }
  };

  const pushOnset = useCallback((time: number) => {
    if (runningRef.current) detections.current.push(time);
  }, []);

  const finish = (): void => {
    cleanup();
    runningRef.current = false;
    setRunning(false);
    const data = pending.current;
    if (data) setRun({ ...data, detections: [...detections.current] });
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const frame = (): void => {
    const ac = getCtx();
    if (ac) setPosition((ac.currentTime - anchor.current) / spb.current);
    raf.current = window.requestAnimationFrame(() => frameRef.current());
  };
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const start = useCallback(() => {
    const ac = getCtx();
    if (!ac) return;
    cleanup();

    const s = 60 / tempo;
    spb.current = s;
    const g = buildGrid(offBeat);
    const countStart = ac.currentTime + 0.3;
    const t0 = countStart + COUNT_IN_BEATS * s;
    anchor.current = t0;

    // Métronome : décompte puis toute la durée de l'exercice, accent en début de mesure.
    for (let b = 0; b < COUNT_IN_BEATS; b++) {
      scheduleClick(ac, b === 0, countStart + b * s);
    }
    const beats = totalBeats();
    for (let b = 0; b < beats; b++) {
      scheduleClick(ac, b % BEATS_PER_BAR === 0, t0 + b * s);
    }

    pending.current = {
      grid: g,
      expectedTimes: g.map((n) => t0 + n.beat * s),
      detections: [],
      spb: s,
    };
    detections.current = [];
    setRun(null);
    setPosition(-COUNT_IN_BEATS);
    runningRef.current = true;
    setRunning(true);

    // Marge après la dernière note pour capter une attaque en retard.
    const endAt = t0 + beats * s + 0.4;
    endTimer.current = window.setTimeout(
      () => finishRef.current(),
      Math.max(0, (endAt - ac.currentTime) * 1000),
    );
    raf.current = window.requestAnimationFrame(() => frameRef.current());
  }, [tempo, offBeat]);

  const stop = useCallback(() => {
    cleanup();
    runningRef.current = false;
    setRunning(false);
    setPosition(-COUNT_IN_BEATS);
    pending.current = null;
  }, []);

  const clear = useCallback(() => {
    setRun(null);
    setPosition(-COUNT_IN_BEATS);
  }, []);

  useEffect(() => cleanup, []);

  // Le score se recalcule quand on change la latence : le calibrage se voit
  // immédiatement sans avoir à rejouer l'exercice.
  const score = useMemo(() => {
    if (!run) return null;
    const corrected = run.detections.map((t) => t - latencyMs / 1000);
    return scoreRun(run.grid, run.expectedTimes, corrected, run.spb);
  }, [run, latencyMs]);

  const rawMedianMs = useMemo(() => {
    if (!run) return null;
    const raw = scoreRun(run.grid, run.expectedTimes, run.detections, run.spb);
    return raw.played ? raw.medianSignedMs : null;
  }, [run]);

  return {
    running,
    position,
    score,
    grid: run?.grid ?? grid,
    rawMedianMs,
    start,
    stop,
    clear,
    pushOnset,
  };
}
