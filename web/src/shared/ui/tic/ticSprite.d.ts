// Tipos del sprite de Tic (ticSprite.js, sin dependencias).
export type TicAnim =
  | "idle"
  | "wave"
  | "work"
  | "ok"
  | "err"
  | "think"
  | "point"
  | "help"
  | "info"
  | "success"
  | "warn"
  | "search"
  | "sleep"
  | "love"
  | "idea"
  | "loading"
  | "empty"
  | "notify"
  | "offline"
  | "lock"
  | "404"
  | "upload"
  | "assigned"
  | "fixing"
  | "urgent"
  | "resolved"
  | "coffee"
  | "thanks"
  | "dance"
  | "birthday"
  | "eat"
  | "beach"
  | "christmas"
  | "halloween"
  | "key"
  | "bell";

export const ANIMS: TicAnim[];

export function build(anim: string, frame: number): (string | null)[][];
export function draw(ctx: CanvasRenderingContext2D, anim: string, frame: number): void;
export function mount(canvas: HTMLCanvasElement, anim: string): number;
