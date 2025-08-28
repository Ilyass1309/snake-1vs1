export type Direction = "Up" | "Down" | "Left" | "Right";

export interface Vec2 { x: number; y: number; }

export interface Snake {
  body: Vec2[];    // [0] = tête
  dir: Direction;
  alive: boolean;
  grow: number;    // >0 si doit grandir (ne pas retirer la queue sur X ticks)
  color: string;
  name: "player" | "ai";
}

export interface GameConfig {
  cols: number;   // largeur grille en cases
  rows: number;   // hauteur grille en cases
  speed: number;  // ticks par seconde
  cellSize: number; // px par case
}

export type Winner = "player" | "ai" | "draw" | null;

export interface GameState {
  config: GameConfig;
  snakes: [Snake, Snake]; // [0]=player, [1]=ai
  food: Vec2;
  tick: number;
  running: boolean;
  winner: Winner;
}

export interface InputBuffer {
  playerNextDir: Direction | null;
}
