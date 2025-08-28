import { Direction, GameState, Vec2 } from "./types";
import { nextOf, inBounds } from "./rules";

function manhattan(a: Vec2, b: Vec2) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

const DIRS: Direction[] = ["Up", "Down", "Left", "Right"];

// Évite la mort immédiate et se rapproche de la nourriture.
// Simple et performant pour un MVP.
export function aiChooseDirection(state: GameState, level: number = 1): Direction {
  const ai = state.snakes[1];
  const head = ai.body[0];

  // Candidats
  const candidates = DIRS.map(d => {
    const nh = nextOf(d, head);
    const safe =
      inBounds(state, nh) &&
      !state.snakes.some(s => s.body.some(b => b.x === nh.x && b.y === nh.y));
    const dist = manhattan(nh, state.food);
    return { d, nh, safe, dist };
  });

  // --- NIVEAU 1 : centré pomme mais beaucoup d'erreurs ---
  if (level <= 1) {
    // Objectif: aller souvent vers la pomme MAIS mourir fréquemment (prend des risques murs/corps)
    const sorted = [...candidates].sort((a,b)=>a.dist-b.dist);
    const bestDist = sorted[0].dist;
    const bestDistMoves = sorted.filter(c => c.dist === bestDist); // inclut possiblement des unsafe (mur/corps)
  const safeBest = bestDistMoves.filter(c=>c.safe);
    const safeAll = candidates.filter(c=>c.safe);
    const unsafeAll = candidates.filter(c=>!c.safe);

  // 65%: mouvement qui réduit au maximum la distance (peut être unsafe => collisions murs/corps)
  if (Math.random() < 0.65) {
      const pick = bestDistMoves[Math.floor(Math.random()*bestDistMoves.length)];
      return pick.d;
    }
  // 20%: mouvement explicitement dangereux (mur/corps) pour augmenter la mortalité
  if (unsafeAll.length && Math.random() < 0.85) return unsafeAll[Math.floor(Math.random()*unsafeAll.length)].d;
  // 10%: meilleur safe (si existe)
  if (safeBest.length && Math.random() < 0.95) return safeBest[0].d;
  // 3%: safe aléatoire (diversité)
  if (safeAll.length && Math.random() < 0.98) return safeAll[Math.floor(Math.random()*safeAll.length)].d;
  // 2%: totalement aléatoire
    return candidates[Math.floor(Math.random()*candidates.length)].d;
  }

  // --- NIVEAU 2 : centré pomme avec erreurs modérées ---
  if (level === 2) {
    const safe = candidates.filter(c => c.safe).sort((a,b)=>a.dist-b.dist);
    const unsafe = candidates.filter(c => !c.safe).sort((a,b)=>a.dist-b.dist);
    if (safe.length) {
      // 80% meilleur safe
      if (Math.random() < 0.80) return safe[0].d;
      // 10% deuxième meilleur
      if (safe.length > 1 && Math.random() < 0.90) return safe[1].d;
      // 5% safe aléatoire
      if (Math.random() < 0.95) return safe[Math.floor(Math.random()*safe.length)].d;
      // 5% erreur dangereuse
      if (unsafe.length) return unsafe[0].d;
      return safe[0].d;
    }
    // aucun safe -> choisir celui qui rapproche (ou second 25%)
    const ordered = [...candidates].sort((a,b)=>a.dist-b.dist);
    if (ordered.length > 1 && Math.random() < 0.25) return ordered[1].d;
    return ordered[0].d;
  }

  // Niveau 3 : focalisé pomme + évite l'auto-suicide + opportunités de piège
  const depth = 5;
  function freeScore(pos: Vec2): number {
    const visited = new Set<string>();
    const queue: {p:Vec2; d:number;}[] = [{p:pos,d:0}];
    let i = 0; let score = 0;
    while (i < queue.length) {
      const {p,d} = queue[i++];
      const key = p.x+','+p.y; if (visited.has(key)) continue; visited.add(key); score++;
      if (d >= depth) continue;
      for (const dir of DIRS) {
        const np = nextOf(dir, p);
        if (!inBounds(state, np)) continue;
        const occ = state.snakes.some(s => s.body.some(b => b.x===np.x && b.y===np.y));
        if (!occ) queue.push({p:np,d:d+1});
      }
    }
    return score;
  }
  const enriched = candidates.map(c => ({...c, space: freeScore(c.nh)}));
  const safe = enriched.filter(c => c.safe);

  const player = state.snakes[0];
  const playerHead = player.body[0];
  const playerNext = nextOf(player.dir, playerHead);

  if (safe.length) {
    // Opportunité de piéger: si on peut aller sur la case où le joueur va (interception) ET qu'un autre move du joueur serait dangereux
    const intercept = safe.find(s => s.nh.x === playerNext.x && s.nh.y === playerNext.y);
    if (intercept) {
      // Vérifie si le joueur a peu d'issues derrière cette case (espace faible)
      const escapeDirs = DIRS.map(d => nextOf(d, playerNext)).filter(p => inBounds(state, p));
      const escapeFree = escapeDirs.filter(p => !state.snakes.some(snk => snk.body.some(b => b.x===p.x && b.y===p.y))).length;
      if (escapeFree <= 1) return intercept.d; // tenter le piège
    }
    // Sélection normale: priorité distance -> espace (pour ne pas se bloquer)
    safe.sort((a,b)=> a.dist - b.dist || b.space - a.space);
    const bestDist = safe[0].dist;
    const sameDist = safe.filter(s => s.dist === bestDist);
    if (sameDist.length > 1) {
      // légère préférence pour plus d'espace
      sameDist.sort((a,b)=> b.space - a.space);
      return sameDist[0].d;
    }
    return safe[0].d;
  }
  // Aucun safe (situation bloquée) : choisir celui qui retarde la mort (plus d'espace) ou va vers nourriture pour potentielle croissance
  const unsafeOrdered = enriched.sort((a,b)=> b.space - a.space || a.dist - b.dist);
  return unsafeOrdered[0].d;

  // (fin niveau 3)
}

// --- NIVEAU 4 : heuristique avancée mais pas parfaite ---
// Idées :
// 1. Simule 2 coups à l'avance (propre + estimation joueur) pour éviter de se coincer.
// 2. Priorise chemins qui gardent un grand "territoire" accessible après le mouvement.
// 3. Évite d'approcher la tête du joueur de face (head-to-head) si désavantage longueur.
// 4. Introduit petite part d'aléa pour rester battable (~7%).
function chooseLevel4(state: GameState): Direction {
  const ai = state.snakes[1];
  const head = ai.body[0];
  const player = state.snakes[0];
  const playerHead = player.body[0];
  const currentFoodDist = manhattan(head, state.food);

  interface NodeInfo { d: Direction; nh: Vec2; safe: boolean; dist: number; space: number; futureSpace: number; danger: number; score: number; }

  function isOccupied(p: Vec2): boolean {
    return state.snakes.some(s => s.body.some(b => b.x===p.x && b.y===p.y));
  }

  function flood(p: Vec2, limit=60): number { // plus large que niveau 3
    const vis = new Set<string>();
    const q: Vec2[] = [p];
    let i=0; let count=0;
    while (i<q.length && count < limit) {
      const cur = q[i++];
      const key = cur.x+','+cur.y; if (vis.has(key)) continue; vis.add(key); count++;
      for (const d of DIRS) {
        const np = nextOf(d, cur);
        if (!inBounds(state, np)) continue;
        if (isOccupied(np)) continue;
        q.push(np);
      }
    }
    return count;
  }

  // Pré-calc joueur pour head-to-head risk
  const playerLen = player.body.length;
  const aiLen = ai.body.length;

  const base: NodeInfo[] = DIRS.map(d => {
    const nh = nextOf(d, head);
    const safe = inBounds(state, nh) && !isOccupied(nh);
    const dist = manhattan(nh, state.food);
    const space = safe ? flood(nh, 80) : 0;
    return { d, nh, safe, dist, space, futureSpace:0, danger:0, score:0 };
  });

  // Mesures globales pour évaluer encerclement / proximité mur
  const currentSpace = flood(head, 120);
  const boardArea = state.config.cols * state.config.rows;
  const encircled = currentSpace < boardArea * 0.18; // zone assez restreinte
  function wallDistance(p: Vec2): number {
    const { cols, rows } = state.config;
    return Math.min(p.x, p.y, cols-1-p.x, rows-1-p.y);
  }
  const currentWallDist = wallDistance(head);

  // Lookahead (1 coup futur) – simule meilleur déplacement suivant
  for (const n of base) {
    if (!n.safe) continue;
    // Simule positions serpent AI tête -> n.nh (corps suivant approximé: ignore la queue qui avance) pour estimation simple
    const virtualHead = n.nh;
    let bestFuture = 0;
    for (const d2 of DIRS) {
      const nh2 = nextOf(d2, virtualHead);
      if (!inBounds(state, nh2)) continue;
      if (isOccupied(nh2)) continue;
      const space2 = flood(nh2, 50);
      if (space2 > bestFuture) bestFuture = space2;
    }
    n.futureSpace = bestFuture * 0.9; // léger amortissement

    // Danger: proximité tête joueur et potentiel face-à-face défavorable
    const manhToPlayer = manhattan(n.nh, playerHead);
    if (manhToPlayer === 1) {
      // si mêmes longueurs ou plus court -> plus dangereux
      n.danger += (playerLen >= aiLen ? 25 : 10);
    } else if (manhToPlayer === 2) {
      n.danger += 4;
    }

  // Proximité mur persistante : décourage rester collé si alternative
  const wd = wallDistance(n.nh);
  if (wd <= 0) n.danger += 18; else if (wd === 1) n.danger += 9; else if (wd === 2) n.danger += 3;
  // Si on est collé au mur actuellement et ce coup ne s'éloigne pas, petit malus supplémentaire
  if (currentWallDist <=1 && wd <= currentWallDist) n.danger += 6;

  // Risque d'enfermement: chute forte d'espace relative
  if (n.space < currentSpace * 0.55) n.danger += 22;
  else if (n.space < currentSpace * 0.7) n.danger += 10;
  // Bonus expansion d'espace notable
  if (n.space > currentSpace * 1.10) n.danger -= 8;
  }

  // Scoring multi-critères
  const safeNodes = base.filter(b=>b.safe);
  const bestFoodDist = safeNodes.length ? Math.min(...safeNodes.map(b=>b.dist)) : currentFoodDist;
  // Moyenne espace pour pénaliser coups qui contractent trop
  const avgSpace = safeNodes.length ? safeNodes.reduce((a,b)=>a+b.space,0)/safeNodes.length : 0;
  for (const n of base) {
    // Progression vers la nourriture : différence de distance actuelle - nouvelle
    const progress = currentFoodDist - n.dist; // positif si rapproche
    // Encourage prendre la pomme quand proche
    const foodScore = n.safe ? (progress * 22 + (n.dist===0?90:0)) : -90;
    const spaceWeight = encircled ? 1.05 : 0.7;
    const futureWeight = encircled ? 0.8 : 0.5;
    const wallReliefBonus = Math.max(0, wallDistance(n.nh) - currentWallDist) * 3.2; // s'éloigner du mur
    const spaceScore = n.space * spaceWeight;
    const futureScore = n.futureSpace * futureWeight;
    // Contraction pénalisée si en dessous de 60% de la moyenne safe
    if (n.safe && avgSpace && n.space < avgSpace * 0.6) n.danger += 14;
    if (n.safe && avgSpace && n.space < avgSpace * 0.4) n.danger += 28;
    // Empêcher tentatives de demi-tour (ignorées plus loin sinon) : gros malus pour ne pas rester bloqué direction opposée rejetée
    if ((ai.dir === 'Up' && n.d === 'Down') || (ai.dir==='Down'&&n.d==='Up') || (ai.dir==='Left'&&n.d==='Right') || (ai.dir==='Right'&&n.d==='Left')) {
      n.danger += 40; // sera très rarement choisi
    }
    const penalty = n.danger * 1.3 + (n.safe?0:100);
    n.score = foodScore + spaceScore + futureScore + wallReliefBonus - penalty;
  }

  const valids = base.filter(b=>b.safe);
  if (!valids.length) {
    // fallback: choisir celui qui maximise espace immédiat
    return base.sort((a,b)=> b.space - a.space || a.dist - b.dist)[0].d;
  }
  valids.sort((a,b)=> b.score - a.score || b.space - a.space || a.dist - b.dist);
  // Petite diversité contrôlée : si top1 très proche du top2 (<4 points), 10% chance de choisir top2
  if (valids.length > 1 && (valids[0].score - valids[1].score) < 4 && Math.random()<0.10) return valids[1].d;
  return valids[0].d;
}

// --- NIVEAU 5 : quasi impossible ---
// Combinaison :
// - Score multi-critères (distance nourriture, espace accessible, éloignement mur, piège joueur, sécurité future)
// - Lookahead 2 plis (en ignorant le déplacement de queue avancé pour simplifier mais avec pénalité de densité)
// - Préférence pour trajectoires qui minimisent le risque head-to-head et maintiennent un gradient de sortie.
// - Réduction drastique de l'aléa (1%).
// Restent battable: pas de vraie planification exhaustive ni Hamiltonien complet; erreurs possibles en tunnels complexes.
function chooseLevel5(state: GameState): Direction {
  const ai = state.snakes[1];
  const player = state.snakes[0];
  const head = ai.body[0];
  const playerHead = player.body[0];
  const aiLen = ai.body.length; const playerLen = player.body.length;

  interface NodeInfo { d: Direction; nh: Vec2; safe: boolean; dist: number; space: number; danger: number; score: number; future: number; }
  function isOcc(p:Vec2):boolean { return state.snakes.some(s=>s.body.some(b=>b.x===p.x && b.y===p.y)); }
  function wallDist(p:Vec2){ const {cols,rows}=state.config; return Math.min(p.x,p.y,cols-1-p.x,rows-1-p.y); }
  function flood(p:Vec2, limit=140){ const vis=new Set<string>(); const q:[Vec2,number][]=[[p,0]]; let i=0,c=0; while(i<q.length && c<limit){ const [cur,d]=q[i++]; const k=cur.x+','+cur.y; if(vis.has(k))continue; vis.add(k); c++; if(d>20) continue; for(const dir of DIRS){ const np=nextOf(dir,cur); if(!inBounds(state,np)||isOcc(np)) continue; q.push([np,d+1]); } } return c; }
  function headToHeadPenalty(pos:Vec2){ const m=manhattan(pos,playerHead); if(m===0) return 100; if(m===1) return playerLen>=aiLen?55:18; if(m===2) return 6; return 0; }

  const base: NodeInfo[] = DIRS.map(d=>{ const nh=nextOf(d,head); const safe=inBounds(state,nh)&&!isOcc(nh); const dist=manhattan(nh,state.food); const space = safe? flood(nh):0; return {d,nh,safe,dist,space,danger:0,score:0,future:0}; });
  const currentSpace = flood(head);
  const currentWall = wallDist(head);

  // 2-ply lookahead (approx) sur moves sûrs
  for(const n of base){ if(!n.safe) continue; let bestFuture = 0; let accumRisk=0; for(const d2 of DIRS){ const nh2=nextOf(d2,n.nh); if(!inBounds(state,nh2)||isOcc(nh2)) { accumRisk+=8; continue; } const space2=flood(nh2,90); if(space2>bestFuture) bestFuture=space2; accumRisk += headToHeadPenalty(nh2)*0.4; } n.future = bestFuture; n.danger += accumRisk*0.7; }

  for(const n of base){
    // Danger immédiat
    n.danger += headToHeadPenalty(n.nh);
    const wd=wallDist(n.nh); if(wd<=0) n.danger+=30; else if(wd===1) n.danger+=12; else if(wd===2) n.danger+=4;
    if(currentWall<=1 && wd<=currentWall) n.danger+=10;
    // Perte sévère d'espace
    if(n.space < currentSpace*0.45) n.danger+=40; else if(n.space < currentSpace*0.65) n.danger+=18;
    // Bonus expansion
    if(n.space > currentSpace*1.15) n.danger-=12;
    // Score distance nourriture (soft) + espace + futur
    const foodScore = n.safe ? (100 - Math.min(100,n.dist*4)) : -200;
    const spaceScore = n.space*1.1;
    const futureScore = n.future*0.9;
    const relief = Math.max(0, wd - currentWall)*6;
    const containment = (n.space/currentSpace)*22; // favorise conserver ratio
    n.score = foodScore + spaceScore + futureScore + relief + containment - n.danger*1.4 + (n.safe?50:-150);
  }

  const valids = base.filter(b=>b.safe);
  if(!valids.length){
    return base.sort((a,b)=> (b.space - a.space) || (a.dist - b.dist))[0].d;
  }
  valids.sort((a,b)=> b.score - a.score || b.space - a.space);
  if(valids.length>2 && Math.random()<0.01){
    return valids[Math.floor(Math.random()*Math.min(2,valids.length))].d;
  }
  return valids[0].d;
}

export function aiChooseDirectionAdvanced(state: GameState, level: number): Direction {
  if (level >= 5) return chooseLevel5(state);
  if (level === 4) return chooseLevel4(state);
  return aiChooseDirection(state, level); // délègue aux niveaux 1-3 existants
}
