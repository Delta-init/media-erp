"use client";

import { useEffect, useState } from "react";
import type { Task, TaskInterval } from "@/types/project";

function accumulatedSeconds(intervals: TaskInterval[]): number {
  let total = 0;
  for (const iv of intervals) {
    if (iv.started_at && iv.ended_at) {
      total += (new Date(iv.ended_at).getTime() - new Date(iv.started_at).getTime()) / 1000;
    }
  }
  return Math.floor(total);
}

export function useTaskTimer(task: Task) {
  const isRunning   = task.status === "started";
  const isCompleted = task.status === "approved";
  const intervals   = task.timing?.intervals ?? [];
  const hasTimer    = isRunning || intervals.length > 0;
  const pauseCount  = intervals.filter(iv => iv.ended_at !== null).length;

  // Sum of all closed (paused) intervals — constant between re-renders.
  const base = accumulatedSeconds(intervals);

  // The started_at of the CURRENT open interval (null when paused/not started).
  // This is derived from task data so it changes when the server returns a new
  // interval after break → started, giving useEffect a fresh dep to re-run on.
  const last = intervals[intervals.length - 1];
  const openStart = (last && !last.ended_at)
    ? new Date(last.started_at).getTime()
    : null;

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning || openStart === null) {
      setElapsed(0);
      return;
    }
    // Compute elapsed directly from the server-supplied started_at timestamp so
    // we never depend on a stale React state value for "now".
    const tick = () => setElapsed(Math.floor((Date.now() - openStart) / 1000));
    tick(); // snap immediately — no stale display on first render
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRunning, openStart]);

  if (!hasTimer) {
    return { seconds: 0, isRunning: false, isCompleted, hasTimer: false, pauseCount: 0 };
  }

  if (isCompleted && task.timing?.total_seconds != null) {
    return {
      seconds: task.timing.total_seconds,
      isRunning: false,
      isCompleted: true,
      hasTimer: true,
      pauseCount,
    };
  }

  const seconds = base + (isRunning ? elapsed : 0);
  return { seconds, isRunning, isCompleted, hasTimer: true, pauseCount };
}

export function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** Live HH:MM:SS stopwatch format for the Started column. */
export function formatSecondsHMS(s: number): string {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
