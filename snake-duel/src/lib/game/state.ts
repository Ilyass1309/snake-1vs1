import { GameConfig, GameState, Snake, Vec2, Direction } from "./types";
import { mulberry32 } from "./rng";

export function vec(x: number, y: number): Vec2 { return { x, y }; }

export function createConfig(): GameConfig {
  return {
    cols: 30,
    rows: 20,
    speed: 12,      // 12 ticks/sec (réglable)
    cellSize: 24,   // 24 px par case
  };
}

export function createSnake(
  name: "player" | "ai",
  head: Vec2,
  dir: Direction,
  color: string
): Snake {
  return {
    name,
    body: [head],
    dir,
    alive: true,
    grow: 2, // commence avec 3 segments
    color,
  };
}

export function randomEmptyCell(
  state: GameState,
  seed = 1234
): Vec2 {
  const rnd = mulberry32(seed + state.tick);
  while (true) {
    const x = Math.floor(rnd() * state.config.cols);
    const y = Math.floor(rnd() * state.config.rows);
    const cell = { x, y };
    const occupied = state.snakes.some(s =>
      s.body.some(b => b.x === cell.x && b.y === cell.y)
    );
    if (!occupied) return cell;
  }
}

export function createInitialState(seed = 42): GameState {
  const config = createConfig();

  // Couleurs distinctes (joueur vert, IA bleu)
  const player = createSnake("player", vec(5, Math.floor(config.rows/2)), "Right", "#3CE872");
  const ai     = createSnake("ai", vec(config.cols - 6, Math.floor(config.rows/2)), "Left", "#3C9BFF");

  const state: GameState = {
    config,
    snakes: [player, ai],
    food: vec(Math.floor(config.cols/2), Math.floor(config.rows/2)),
    tick: 0,
    running: false,
    winner: null,
  };

  // place une nourriture initiale qui n'est pas sur un serpent
  state.food = randomEmptyCell(state, seed);

  return state;
}
