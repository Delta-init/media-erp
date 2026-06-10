"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/types/project";

function accumulatedSeconds(task: Task): number {
  let total = 0;
  for (const iv of task.timing?.intervals ?? []) {
    if (iv.started_at && iv.ended_at) {
      total += (new Date(iv.ended_at).getTime() - new Date(iv.started_at).getTime()) / 1000;
    }
  }
  return Math.floor(total);
}

function openIntervalSeconds(task: Task, now: number): number {
  const intervals = task.timing?.intervals ?? [];
  const last = intervals[intervals.length - 1];
  if (last && !last.ended_at) {
    return Math.max(0, Math.floor((now - new Date(last.started_at).getTime()) / 1000));
  }
  return 0;
}

export function useTaskTimer(task: Task) {
  const isRunning   = task.status === "started";
  const isCompleted = task.status === "approved";
  const intervals   = task.timing?.intervals ?? [];
  const hasTimer    = intervals.length > 0;

  // Each closed interval (ended_at is set) = one pause cycle
  const pauseCount = intervals.filter(iv => iv.ended_at !== null).length;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  if (!hasTimer) return { seconds: 0, isRunning: false, isCompleted, hasTimer: false, pauseCount: 0 };

  if (isCompleted && task.timing?.total_seconds != null) {
    return { seconds: task.timing.total_seconds, isRunning: false, isCompleted: true, hasTimer: true, pauseCount };
  }

  const seconds = accumulatedSeconds(task) + (isRunning ? openIntervalSeconds(task, now) : 0);
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
