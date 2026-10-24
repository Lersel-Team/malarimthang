// Dev-only test hooks. Imported from main.ts behind import.meta.env.DEV.
import type Phaser from 'phaser';

declare global {
  interface Window {
    __game?: Phaser.Game;
  }
}

export function exposeGame(game: Phaser.Game): void {
  window.__game = game;
}

/** Dev fast-forward multiplier from ?speed=, default 1. */
export function readDevSpeed(search: string): number {
  return Number(new URLSearchParams(search).get('speed')) || 1;
}
