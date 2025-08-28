"use client";

import { GameState, Direction, InputBuffer } from "./types";
import { createInitialState } from "./state";
import { handleTick, isOpposite } from "./rules";
import { aiChooseDirection, aiChooseDirectionAdvanced } from "./ai";

type Listener = (state: GameState) => void;
type EndGameHook = (state: GameState, aiLevel: number) => void;

export class GameEngine {
  state: GameState;
  input: InputBuffer = { playerNextDir: null };
  listeners: Set<Listener> = new Set();
  endGameHooks: Set<EndGameHook> = new Set();
  intervalId: ReturnType<typeof setInterval> | null = null;
  aiLevel: number = 2; // niveau par défaut

  constructor() {
    this.state = createInitialState();
  }

  reset() {
    const prevSpeed = this.state?.config.speed;
    this.stop();
    this.state = createInitialState(Math.floor(Math.random()*100000));
    if (prevSpeed) {
      this.state.config.speed = prevSpeed; // conserve la vitesse choisie
    }
    this.input.playerNextDir = null;
  // (mode test IA vs IA retiré)
    this.emit();
  }

  start() {
    if (this.intervalId) return;
    this.state.running = true;
    const msPerTick = Math.max(40, 1000 / this.state.config.speed); // cap à 25fps logique mini
    this.intervalId = setInterval(() => {
  const playerDir: Direction | null = this.input.playerNextDir;
  const aiDir: Direction = this.aiLevel >=4 ? aiChooseDirectionAdvanced(this.state, this.aiLevel) : aiChooseDirection(this.state, this.aiLevel);
  handleTick(this.state, playerDir, aiDir);
      // consomme l'input (un seul changement par tick)
      this.input.playerNextDir = null;
      if (this.state.winner) {
        // déclenche hooks fin de partie avant stop
  for (const h of this.endGameHooks) h(this.state, this.aiLevel);
        this.stop();
      }
      this.emit();
    }, msPerTick);
    this.emit();
  }

  stop() {
    this.state.running = false;
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.emit();
  }

  setSpeed(tps: number) {
    this.state.config.speed = tps;
    if (this.state.running) {
      // redémarre la boucle avec nouveau timing
      this.stop();
      this.start();
    } else {
      this.emit();
    }
  }

  onKey(dir: Direction) {
    // on stocke pour le prochain tick (le moteur empêche les demi-tours)
    const curr = this.state.snakes[0].dir;
    if (!isOpposite(curr, dir)) {
      this.input.playerNextDir = dir;
    }
  }

  setAiLevel(level: number) {
  this.aiLevel = Math.max(1, Math.min(5, level));
    // émettre pour que l'UI reflète le niveau si besoin
    this.emit();
  }

  // (méthodes test IA vs IA supprimées)

  subscribe(fn: Listener) {
  this.listeners.add(fn);
  fn(this.state);
  return () => { 
    // ne retourne rien !
    this.listeners.delete(fn); 
  };
}
  onEndGame(h: EndGameHook) {
    this.endGameHooks.add(h);
    return () => this.endGameHooks.delete(h);
  }
  private emit() {
    // Clone profond pour forcer React à détecter le changement
    const clonedState = typeof structuredClone === 'function'
      ? structuredClone(this.state)
      : JSON.parse(JSON.stringify(this.state));
    for (const l of this.listeners) l(clonedState);
  }
}
