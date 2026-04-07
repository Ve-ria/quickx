import { spawn } from "node:child_process";

import type { CodexProfile } from "../types.js";

export function maskKey(key: string): string {
  if (!key) {
    return "(not set)";
  }

  const visible = 4;
  if (key.length <= visible) {
    return "*".repeat(key.length);
  }

  return key.slice(0, visible) + "*".repeat(key.length - visible);
}

export function truncate(value: string, max: number): string {
  if (!value || value.length <= max) {
    return value;
  }

  return `${value.slice(0, Math.max(0, max - 1))}...`;
}

export function pickWindow<T>(
  items: T[],
  selectedIndex: number,
  limit = 12,
): { start: number; rows: T[] } {
  if (items.length === 0) {
    return { start: 0, rows: [] };
  }

  const clamped = Math.min(Math.max(selectedIndex, 0), items.length - 1);
  const half = Math.floor(limit / 2);
  const maxStart = Math.max(0, items.length - limit);
  const start = Math.max(0, Math.min(maxStart, clamped - half));

  return {
    start,
    rows: items.slice(start, start + limit),
  };
}

export function sanitizeEmail(email: string): string {
  return email.replaceAll("@", "-").replaceAll(".", "-");
}

export function cloneProfile(profile: CodexProfile): CodexProfile {
  return { ...profile };
}

export function cloneProfiles(profiles: CodexProfile[]): CodexProfile[] {
  return profiles.map((profile) => cloneProfile(profile));
}

export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/** Levenshtein distance (max 3) — returns Infinity if over threshold */
function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return Infinity;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const next = a[i - 1] === b[j - 1] ? (row[j - 1] ?? 0) : 1 + Math.min(prev, row[j] ?? 0, row[j - 1] ?? 0);
      row[j - 1] = prev;
      prev = next;
    }
    row[b.length] = prev;
  }
  return row[b.length] ?? Infinity;
}

export function findSimilarNames(name: string, candidates: string[]): string[] {
  return candidates
    .map((c) => ({ name: c, dist: editDistance(name.toLowerCase(), c.toLowerCase()) }))
    .filter(({ dist }) => dist <= 3)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map(({ name: n }) => n);
}

export function openBrowser(url: string): boolean {
  try {
    if (process.platform === "darwin") {
      const child = spawn("open", [url], { detached: true, stdio: "ignore" });
      child.unref();
      return true;
    }

    if (process.platform === "win32") {
      const child = spawn("cmd", ["/c", "start", "", url], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return true;
    }

    const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
