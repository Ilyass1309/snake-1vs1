/* eslint-disable react/no-unescaped-entities */
"use client";

import { useEffect, useRef, useState } from "react";
import { GameEngine } from "@/lib/game/engine";
import { recordGameResult, loadAIStats, computeWinrate } from "@/lib/game/aiStats";
import { Direction, GameState } from "@/lib/game/types";

const engine = new GameEngine();

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<GameState>(engine.state);
  const [showIntro, setShowIntro] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [aiLevel, setAiLevel] = useState<number>(engine.aiLevel);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [renderCellSize, setRenderCellSize] = useState(engine.state.config.cellSize);
  const settingsBandRef = useRef<HTMLDivElement|null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement|null>(null);
  const showStartOverlay = !state.running && !state.winner && !hasPlayedOnce;
  const rows = state.config.rows;
  const cols = state.config.cols;
  const [wins, setWins] = useState({ player: 0, ai: 0 });
  const lastWinnerRef = useRef<string | null>(null);
  const [winFlash, setWinFlash] = useState({ player: false, ai: false });
  const [aiStatsSnapshot, setAiStatsSnapshot] = useState(()=>loadAIStats());
  const [showLevel4Congrats, setShowLevel4Congrats] = useState(false);
  const lastGameAiLevelRef = useRef(aiLevel);
  // winrate UI retirée
  // plus de position absolue pour le panneau winrate
  // Resize responsive: ajuste la taille des cellules pour remplir la largeur dispo sans flouter.
  useEffect(() => {
    function recompute() {
      const el = canvasContainerRef.current;
      if (!el) return;
      const available = el.clientWidth;
      const cols = state.config.cols;
      const target = Math.floor(available / cols);
      const clamped = Math.max(18, Math.min(40, target));
      setRenderCellSize(clamped);
    }
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [state.config.cols]);
  // (ancien ordre des hooks déplacé plus haut)
  // Debug overlay condition
  useEffect(() => {
    console.log('[overlay]', { running: state.running, winner: state.winner, hasPlayedOnce, showStartOverlay, showIntro });
  }, [state.running, state.winner, hasPlayedOnce, showStartOverlay, showIntro]);

  // Panneau winrate désormais géré par flex layout – pas d'effet de position.

  // Incrémente les victoires une seule fois par partie terminée
  useEffect(() => {
    if (state.winner && state.winner !== 'draw' && lastWinnerRef.current !== state.winner) {
      lastWinnerRef.current = state.winner;
      setWins(w => state.winner === 'player' ? { ...w, player: w.player + 1 } : { ...w, ai: w.ai + 1 });
      // déclenche animation flash
      if (state.winner === 'player') {
        setWinFlash(f => ({...f, player: true}));
        setTimeout(()=> setWinFlash(f => ({...f, player:false})), 900);
      } else {
        setWinFlash(f => ({...f, ai: true}));
        setTimeout(()=> setWinFlash(f => ({...f, ai:false})), 900);
      }
    }
    if (state.running && !state.winner) {
      // nouvelle partie en cours -> on réinitialise le marqueur pour permettre le même vainqueur consécutif
      lastWinnerRef.current = null;
    }
  }, [state.winner, state.running]);

  // Déclenche popup spéciale si joueur bat niveau 4
  useEffect(() => {
    if (state.winner === 'player' && lastWinnerRef.current === 'player' && lastGameAiLevelRef.current === 4) {
      setShowLevel4Congrats(true);
    }
  }, [state.winner]);

  // Abonnement état
  useEffect(() => {
  const unsubscribe = engine.subscribe(setState);
  const unEnd = engine.onEndGame((st, lvl) => {
    if (st.winner) {
      const w = st.winner === 'player' || st.winner === 'ai' || st.winner === 'draw' ? st.winner : null;
      if (w) {
        const saved = recordGameResult(lvl, w);
        setAiStatsSnapshot(saved);
      }
    }
  });
    // Restaure vitesse depuis localStorage
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('snakeSpeed') : null;
      if (saved) {
        const v = parseInt(saved);
        if (!isNaN(v)) engine.setSpeed(Math.max(12, Math.min(20, v)));
      }
    } catch {}
    return () => {
      // on appelle la fonction, mais on NE retourne rien
      unsubscribe();
      unEnd();
    };
  }, []);

  // Rendu Canvas (à chaque maj d'état)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
  const { cols, rows } = state.config;
  const cellSize = renderCellSize;
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fond (palette sombre neutre)
    ctx.fillStyle = '#424340';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Légère vignette
    const vignette = ctx.createRadialGradient(
      canvas.width/2, canvas.height/2, Math.min(canvas.width, canvas.height)*0.1,
      canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)*0.75
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0,0,canvas.width, canvas.height);

    // Grille légère
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = "#606C5A";
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize + 0.5, 0);
      ctx.lineTo(x * cellSize + 0.5, rows * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize + 0.5);
      ctx.lineTo(cols * cellSize, y * cellSize + 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

  // Food
  ctx.save();
  // Food rouge
  const foodX = state.food.x * cellSize;
  const foodY = state.food.y * cellSize;
  ctx.shadowColor = '#ff3b30';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#ff3b30';
  const radius = (cellSize - 6) / 2;
  ctx.beginPath();
  ctx.arc(foodX + cellSize/2, foodY + cellSize/2, radius, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // petite feuille décor
  ctx.fillStyle = '#34c759';
  ctx.beginPath();
  ctx.ellipse(foodX + cellSize/2 + radius/3, foodY + cellSize/2 - radius/1.2, radius/3, radius/5, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

    // Snakes
    for (const s of state.snakes) {
      // corps
      for (let i = 0; i < s.body.length; i++) {
        const b = s.body[i];
        const pad = i === 0 ? 1 : 3; // tête plus “pleine”
        ctx.save();
  const baseColor = s.color || (s === state.snakes[0] ? '#3CE872' : '#3C9BFF');
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = i === 0 ? 12 : 4;
        ctx.fillStyle = baseColor;
        ctx.fillRect(b.x * cellSize + pad, b.y * cellSize + pad, cellSize - pad*2, cellSize - pad*2);
        ctx.restore();
      }
      // halo tête
      const head = s.body[0];
      ctx.globalAlpha = 0.18;
  ctx.fillStyle = (s.color === '#3CE872' ? '#3CE87255' : '#3C9BFF55');
      ctx.beginPath();
      ctx.arc(head.x * cellSize + cellSize/2, head.y * cellSize + cellSize/2, cellSize/1.2, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Overlay fin
    if (state.winner) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0,0,canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        state.winner === "draw" ? "Égalité !" :
        state.winner === "player" ? "Tu as gagné !" : "L'IA a gagné !",
        canvas.width/2,
        canvas.height/2
      );
    }
  }, [state, renderCellSize]);

  // Clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      let dir: Direction | null = null;
      if (k === "arrowup" || k === "z") dir = "Up";
      else if (k === "arrowdown" || k === "s") dir = "Down";
      else if (k === "arrowleft" || k === "q") dir = "Left";
      else if (k === "arrowright" || k === "d") dir = "Right";
      if (dir) {
        e.preventDefault();
        engine.onKey(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ferme la bande paramètres si clic extérieur
  useEffect(() => {
    if (!showSettings) return;
    function onDocDown(e: MouseEvent) {
      const band = settingsBandRef.current;
      const btn = settingsButtonRef.current;
      const target = e.target as Node;
      if (band && band.contains(target)) return;
      if (btn && btn.contains(target)) return;
      setShowSettings(false);
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [showSettings]);

  // Ferme stats si clic extérieur
  const statsBandRef = useRef<HTMLDivElement|null>(null);
  const statsButtonRef = useRef<HTMLButtonElement|null>(null);
  useEffect(() => {
    if (!showStats) return;
    function onDown(e: MouseEvent) {
      const band = statsBandRef.current;
      const btn = statsButtonRef.current;
      const t = e.target as Node;
      if (band && band.contains(t)) return;
      if (btn && btn.contains(t)) return;
      setShowStats(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showStats]);

  return (
  <>
  <div className="game-medium p-3 md:p-4 relative" style={{maxHeight:'100vh'}}>
    <h1 className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight pr-14" style={{fontFamily:'JetBrains Mono, Fira Mono, Consolas, monospace'}}>Snake Duel</h1>
  <button
      aria-label="Paramètres"
      className="settings-fab"
      ref={settingsButtonRef}
      disabled={state.running}
      onClick={() => { if (!state.running) setShowSettings(s=>!s); }}
      style={{position:'absolute'}}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09c.7 0 1.31-.4 1.51-1a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06c.46.46 1.12.61 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09c0 .7.4 1.31 1 1.51.7.28 1.36.13 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .7.4 1.31 1.51 1H21a2 2 0 0 1 0 4h-.09c-.7 0-1.31.4-1.51 1Z" />
      </svg>
    </button>
    <button
      aria-label="Statistiques"
      className="settings-fab stats-fab"
      ref={statsButtonRef}
      disabled={state.running}
      onClick={() => { if (!state.running) setShowStats(s=>!s); }}
      style={{position:'absolute'}}
    >
      {/* simple bar chart icon */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="19" x2="4" y2="10"/><line x1="10" y1="19" x2="10" y2="4"/><line x1="16" y1="19" x2="16" y2="14"/><line x1="22" y1="19" x2="2" y2="19"/></svg>
    </button>
    {/* Bande verticale des paramètres */}
  <div ref={settingsBandRef} className={`settings-band ${showSettings ? 'open' : 'closed'}`} aria-hidden={!showSettings}>
      <div className="band-inner">
        <div className="band-header">
          <span className="band-title">Paramètres</span>
        </div>
        <div className="band-section">
          <label className="band-label">Vitesse</label>
          <input
            type="range"
            min={12}
            max={20}
            value={state.config.speed}
            onChange={(e) => { const v = parseInt(e.target.value); engine.setSpeed(v); try { localStorage.setItem('snakeSpeed', String(v)); } catch {}; }}
            className="range"
          />
          <div className="band-value">{state.config.speed} tps</div>
        </div>
        <div className="band-section">
          <label className="band-label">Niveau IA</label>
          <div className="flex gap-2 flex-wrap">
            {[1,2,3,4,5].map(l => (
              <button
                key={l}
                onClick={() => { setAiLevel(l); engine.setAiLevel(l); }}
                className="pill-btn"
                style={{background: aiLevel===l? 'var(--c4)' : 'var(--c5)', color: aiLevel===l? 'var(--c2)' : 'var(--c1)'}}
              >{l}</button>
            ))}
          </div>
        </div>
          {/* Section test IA vs IA retirée */}
      </div>
    </div>

    {/* Bande verticale stats */}
    <div ref={statsBandRef} className={`stats-band ${showStats ? 'open' : 'closed'}`} aria-hidden={!showStats}>
      <div className="band-inner">
        <div className="band-header">
          <span className="band-title">Stats IA</span>
        </div>
        <div className="band-section" style={{gap:'.75rem'}}>
          {[1,2,3,4].map(lvl => {
            const data = aiStatsSnapshot.levels[String(lvl) as '1'|'2'|'3'|'4'] || { games:0, wins:0 };
            const wr = computeWinrate(data);
            return (
              <div key={lvl} style={{display:'flex', flexDirection:'column', gap:'.35rem'}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:'.65rem', letterSpacing:'.18em', textTransform:'uppercase', fontWeight:600, color:'var(--c5)'}}>
                  <span>Niveau {lvl}</span>
                  <span style={{fontFamily:'monospace'}}>{wr}%</span>
                </div>
                <div style={{height:10, borderRadius:6, background:'var(--c1)', position:'relative', overflow:'hidden', border:'1px solid var(--c3)'}}>
                  <div style={{position:'absolute', inset:0, width: wr+'%', background:'linear-gradient(90deg,#10b981,#059669)', transition:'width .6s'}} />
                </div>
                <div style={{textAlign:'right', fontSize:'.55rem', fontFamily:'monospace', opacity:.7}}>{data.wins}/{data.games}</div>
              </div>
            );
          })}
        </div>
        <div className="band-foot">Taux = victoires IA / parties. Plus de parties pour fiabilité.</div>
      </div>
    </div>

    {/* Score bar moderne */}
    <div className="score-bar enhanced">
      <span className="score-player">
  <span className="label">Joueur</span>&nbsp;: {state.snakes[0]?.body.length ?? 0}
        <span className={"wins-pill " + (winFlash.player ? 'flash' : '')} title={`Victoires joueur: ${wins.player}`} aria-label={`Victoires joueur ${wins.player}`}>
          <span className="icon" aria-hidden>🏆</span>{wins.player}
        </span>
      </span>
      <span className="score-ai">
  <span className="label">IA</span>&nbsp;: {state.snakes[1]?.body.length ?? 0}
        <span className={"wins-pill alt " + (winFlash.ai ? 'flash' : '')} title={`Victoires IA: ${wins.ai}`} aria-label={`Victoires IA ${wins.ai}`}>
          <span className="icon" aria-hidden>🏆</span>{wins.ai}
        </span>
      </span>
    </div>

  <div className="flex flex-col md:flex-row items-start md:items-center gap-10 md:gap-14" style={{maxHeight:'calc(100vh - 110px)'}}>
      {/* Winrate panel retiré */}
    {/* Plateau + overlays */}
    <div className="card p-3 md:p-4 flex flex-col self-stretch flex-1 relative" style={{overflow:'visible'}}>
        <div
          ref={canvasContainerRef}
          className="relative w-full"
          style={{ aspectRatio: `${cols} / ${rows}` }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full rounded-lg border border-[#2a2f55]"
            style={{ display: 'block' }}
          />
          {/* Start overlay centré */}
          {showStartOverlay && (
            <>
              <div className="absolute inset-0 z-10 rounded-lg" style={{background: showIntro ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.55)', backdropFilter:'blur(3px)', pointerEvents:'none'}} />
              <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-120%)', fontSize:'0.65rem', letterSpacing:'0.18em', textTransform:'uppercase', color:'#C9E3CC', opacity: showIntro? .6: .85, pointerEvents:'none'}}> {showIntro ? 'Ferme la fenêtre' : 'Prêt ?'} </div>
              <button
                aria-label="Démarrer la partie"
                className="btn-lg btn-start"
                style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', opacity: showIntro ? .45 : 1, pointerEvents: showIntro ? 'none' : 'auto'}}
                onClick={() => { lastGameAiLevelRef.current = aiLevel; setShowLevel4Congrats(false); engine.start(); setHasPlayedOnce(true); setShowSettings(false); }}
              >Démarrer</button>
            </>
          )}
          {/* Restart overlay: bouton centré sous le texte dessiné dans le canvas */}
          {!state.running && state.winner && (
            <>
              <div className="absolute inset-0 z-20 rounded-lg bg-[#00000066] backdrop-blur-sm" style={{pointerEvents:'none'}} />
              <button
                aria-label="Relancer la partie"
                className="btn-lg btn-start"
                style={{position:'absolute', top:'60%', left:'50%', transform:'translate(-50%,-50%)'}}
                onClick={() => { lastGameAiLevelRef.current = aiLevel; setShowLevel4Congrats(false); engine.reset(); engine.start(); setHasPlayedOnce(true); setShowSettings(false); }}
              >Relancer</button>
            </>
          )}
          {/* debug button retiré */}
        </div>
      </div>

    {/* HUD / Panneau simplifié droite */}
  <div className="card p-4 flex flex-col gap-3 relative self-stretch justify-center mt-4">
        <div className="flex justify-center gap-2 mt-1">
          {state.running ? (
            <button onClick={() => { engine.stop(); }} className="modern-btn secondary">Pause</button>
          ) : hasPlayedOnce && !state.winner ? (
            <button onClick={() => { engine.start(); }} className="modern-btn">Reprendre</button>
          ) : null}
        </div>
      </div>
    </div>
      </div>
    {showIntro && (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="close-btn" aria-label="Fermer" onClick={() => setShowIntro(false)}>×</button>
        <h2>Bienvenue dans Snake Duel</h2>
        <p>Affronte l'IA dans un duel de serpents. Mange la nourriture pour grandir et évite murs et collisions. Survis plus longtemps que l'adversaire.</p>
        <p><b>Contrôles :</b> Flèches ou ZQSD pour diriger ton serpent.</p>
        <p>Tu peux ajuster la vitesse et choisir le niveau d'IA (1 à 4) dans les paramètres.</p>
        <div className="under-actions mt-3" style={{justifyContent:'center'}}>
          <button className="btn-lg btn-start" onClick={() => { console.log('[DEBUG] Intro fermée'); setShowIntro(false); setAiStatsSnapshot(loadAIStats()); }}>D'accord</button>
        </div>
      </div>
    </div>
  )}
    {/* (debug nettoyé) */}
    {showLevel4Congrats && (
      <div className="modal-backdrop" style={{zIndex:120}}>
        <div className="modal" style={{maxWidth:560}}>
          <button className="close-btn" aria-label="Fermer" onClick={() => setShowLevel4Congrats(false)}>×</button>
          <h2 style={{fontSize:'1.9rem'}}>Bravo !</h2>
          <p style={{marginTop:'0.5rem'}}>Tu as vaincu l'IA <b>niveau 4</b>, son niveau le plus élevé actuel.</p>
          <p>Sa stratégie évalue désormais l'espace libre, évite les coins et anticipe certains pièges – mais tu as réussi à la battre.</p>
          <p style={{opacity:.8}}>Tu peux continuer à rejouer pour consolider ta domination ou descendre le niveau pour entraîner ta régularité.</p>
          <div className="under-actions mt-4" style={{justifyContent:'center'}}>
            <button className="btn-lg btn-start" onClick={() => { setShowLevel4Congrats(false); engine.reset(); engine.start(); }}>Rejouer</button>
            <button className="modern-btn secondary" style={{padding:'0.55em 1.2em'}} onClick={() => setShowLevel4Congrats(false)}>Fermer</button>
          </div>
        </div>
      </div>
    )}
    </>
  );

}
