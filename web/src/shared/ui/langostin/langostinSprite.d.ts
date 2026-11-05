// Tipos del sprite de Langostin (langostinSprite.js, sin dependencias).
export type LangostinAnim =
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

export const ANIMS: LangostinAnim[];

export function build(anim: string, frame: number): (string | null)[][];
export function draw(ctx: CanvasRenderingContext2D, anim: string, frame: number): void;
export function mount(canvas: HTMLCanvasElement, anim: string): number;
