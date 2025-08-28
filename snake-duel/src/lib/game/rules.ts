import { Direction, GameState, Snake, Vec2 } from "./types";

export function nextOf(dir: Direction, head: Vec2): Vec2 {
  switch (dir) {
    case "Up":    return { x: head.x,     y: head.y - 1 };
    case "Down":  return { x: head.x,     y: head.y + 1 };
    case "Left":  return { x: head.x - 1, y: head.y     };
    case "Right": return { x: head.x + 1, y: head.y     };
  }
}

export function isOpposite(a: Direction, b: Direction) {
  return (a === "Up" && b === "Down")
    || (a === "Down" && b === "Up")
    || (a === "Left" && b === "Right")
    || (a === "Right" && b === "Left");
}

export function inBounds(state: GameState, p: Vec2): boolean {
  return p.x >= 0 && p.x < state.config.cols && p.y >= 0 && p.y < state.config.rows;
}

export function cellOccupiedBySnake(s: Snake, cell: Vec2): boolean {
  return s.body.some(b => b.x === cell.x && b.y === cell.y);
}

export function anySnakeOccupies(state: GameState, cell: Vec2): boolean {
  return state.snakes.some(s => cellOccupiedBySnake(s, cell));
}

export function advanceSnake(s: Snake, newHead: Vec2) {
  s.body.unshift(newHead); // ajoute tête
  if (s.grow > 0) {
    s.grow -= 1; // on garde la queue
  } else {
    s.body.pop(); // enlève la dernière cellule (queue)
  }
}

export function handleTick(
  state: GameState,
  playerNextDir: Direction | null,
  aiNextDir: Direction
): void {
  if (state.winner) return;

  const [player, ai] = state.snakes;

  // Applique les inputs (empêche les demi-tours instantanés)
  if (playerNextDir && !isOpposite(playerNextDir, player.dir)) {
    player.dir = playerNextDir;
  }
  if (aiNextDir && !isOpposite(aiNextDir, ai.dir)) {
    ai.dir = aiNextDir;
  }

  // Calcule prochaines têtes
  const pNext = nextOf(player.dir, player.body[0]);
  const aNext = nextOf(ai.dir, ai.body[0]);

  // Vérifie collisions mur
  if (!inBounds(state, pNext)) player.alive = false;
  if (!inBounds(state, aNext)) ai.alive = false;

  // Si encore en vie, on vérifie collisions corps (simultanées)
  if (player.alive && anySnakeOccupies({ ...state, snakes: [player, ai] }, pNext)) {
    // si pNext sur sa propre queue qui va bouger ? on gère après move,
    // plus simple: on avance puis on teste chevauchements.
  }
  if (ai.alive && anySnakeOccupies(state, aNext)) {
    // idem
  }

  // Avance ceux encore en vie
  if (player.alive) advanceSnake(player, pNext);
  if (ai.alive) advanceSnake(ai, aNext);

  // Collision tête/corps après mouvements
  if (player.alive) {
    // se mord ?
    if (player.body.slice(1).some(b => b.x === pNext.x && b.y === pNext.y)) player.alive = false;
    // mord l'IA ?
    if (ai.body.some(b => b.x === pNext.x && b.y === pNext.y)) player.alive = false;
  }
  if (ai.alive) {
    if (ai.body.slice(1).some(b => b.x === aNext.x && b.y === aNext.y)) ai.alive = false;
    if (player.body.some(b => b.x === aNext.x && b.y === aNext.y)) ai.alive = false;
  }

  // Collision tête vs tête (même cellule)
  if (player.alive && ai.alive && pNext.x === aNext.x && pNext.y === aNext.y) {
    player.alive = false;
    ai.alive = false;
  }

  // Nourriture (grandit si mange)
  if (player.alive && pNext.x === state.food.x && pNext.y === state.food.y) player.grow += 2;
  if (ai.alive && aNext.x === state.food.x && aNext.y === state.food.y) ai.grow += 2;

  // Respawn food si mangée par quelqu’un
  if ((player.alive && pNext.x === state.food.x && pNext.y === state.food.y)
    || (ai.alive && aNext.x === state.food.x && aNext.y === state.food.y)) {
    // respawn sur une case vide
    const empty: Vec2[] = [];
    for (let y = 0; y < state.config.rows; y++) {
      for (let x = 0; x < state.config.cols; x++) {
        const cell = { x, y };
        const occ = state.snakes.some(s => s.body.some(b => b.x === x && b.y === y));
        if (!occ) empty.push(cell);
      }
    }
    if (empty.length > 0) {
      const idx = Math.floor((Math.random()) * empty.length);
      state.food = empty[idx];
    }
  }

  // Vérifie fin de partie
  if (!player.alive && !ai.alive) state.winner = "draw";
  else if (!player.alive) state.winner = "ai";
  else if (!ai.alive) state.winner = "player";

  state.tick += 1;
}
