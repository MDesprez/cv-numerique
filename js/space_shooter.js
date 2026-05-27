/* ===== Easter egg LEO — Space Shooter =====
   Taper L, E, O au clavier pour lancer le jeu.
   Tout en canvas 2D vanilla, sans dépendance.
*/
(function () {
  'use strict';

  // ---------- Supabase (leaderboard) ----------
  const SUPABASE_URL = 'https://hfsrohoomlrrswvxqgpm.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmc3JvaG9vbWxycnN3dnhxZ3BtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NjU5NDksImV4cCI6MjA5NTQ0MTk0OX0.gVL9p3kR-CIErPFdU__F-dLAZU5dkuz7YqwYdM9glM8';
  const LB_TABLE = 'leo_leaderboard';

  async function submitScore(pseudo, score, timeSeconds, levelReached) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${LB_TABLE}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        pseudo: pseudo.slice(0, 12),
        score: Math.max(0, Math.floor(score)),
        time_seconds: Math.max(0, Math.floor(timeSeconds)),
        level_reached: Math.max(1, Math.floor(levelReached)),
      }),
    });
    if (!res.ok) throw new Error('Erreur Supabase ' + res.status);
  }

  async function fetchTop(limit = 100) {
    const url = `${SUPABASE_URL}/rest/v1/${LB_TABLE}?select=pseudo,score,time_seconds,level_reached,created_at&order=score.desc,time_seconds.asc&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) throw new Error('Erreur Supabase ' + res.status);
    return res.json();
  }

  function fmtTime(sec) {
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderLeaderboardRows(rows, highlight) {
    if (!rows || rows.length === 0) {
      return `<div class="leo-lb-empty">Aucun score pour le moment — sois le premier !</div>`;
    }
    return rows.map((r, i) => {
      const rank = i + 1;
      const isHL = highlight && r.pseudo === highlight.pseudo && r.score === highlight.score && r.time_seconds === highlight.timeSeconds;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      return `<div class="leo-lb-row${isHL ? ' me' : ''}">
        <span class="leo-lb-rank">${medal}</span>
        <span class="leo-lb-pseudo">${escapeHTML(r.pseudo)}</span>
        <span class="leo-lb-score">${r.score.toLocaleString('fr-FR')}</span>
        <span class="leo-lb-time">${fmtTime(r.time_seconds)}</span>
        <span class="leo-lb-lvl">Lv ${r.level_reached}</span>
      </div>`;
    }).join('');
  }

  // ---------- Détection de la séquence "leo" ----------
  const SEQUENCE = 'leo';
  let keyBuffer = '';
  let gameInstance = null;

  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (gameInstance) return; // déjà en jeu
    const k = (e.key || '').toLowerCase();
    if (k.length !== 1) return;
    keyBuffer = (keyBuffer + k).slice(-SEQUENCE.length);
    if (keyBuffer === SEQUENCE) {
      keyBuffer = '';
      launchGame();
    }
  });

  // ---------- Sprites placeholder (SVG inline -> data URI) ----------
  function svgDataURI(svg) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  const ASSETS = {
    player: './img/game/player_clean.png',
    asteroid: svgDataURI(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
        <polygon points="20,2 36,10 38,26 28,38 12,36 4,24 6,8" fill="#888" stroke="#444" stroke-width="2"/>
        <circle cx="14" cy="16" r="3" fill="#555"/><circle cx="26" cy="24" r="2" fill="#555"/>
      </svg>`
    ),
    chaser: './img/game/chaser_clean.png',
    tank: './img/game/tank_clean.png',
    boss: './img/game/boss_clean.png',
    elite: './img/game/elite_clean.png',
    carapace0: './img/game/carapace_0.png',
    carapace1: './img/game/carapace_1.png',
    carapace2: './img/game/carapace_2.png',
    carapace3: './img/game/carapace_3.png',
    bulletPlayer: './img/game/bullet_player_clean.png',
    bulletEnemy: './img/game/bullet_enemy_clean.png',
    puDouble: './img/game/pu_double_clean.png',
    puRapid: './img/game/pu_rapid_clean.png',
    puShield: './img/game/pu_shield_clean.png',
    puSpeed: './img/game/pu_speed_clean.png',
    malSlow: './img/game/mal_slow_clean.png',
    malWeak: './img/game/mal_weak_clean.png',
    malDivide: './img/game/mal_divide_clean.png',
  };

  function loadImg(src) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    });
  }

  // ---------- Lancement ----------
  async function launchGame() {
    // Mobile : message + retour
    if ('ontouchstart' in window && window.innerWidth < 900) {
      showMobileMessage();
      return;
    }

    document.body.style.overflow = 'hidden';
    const overlay = document.createElement('div');
    overlay.id = 'leo-game-overlay';
    overlay.innerHTML = `
      <button class="leo-quit" title="Quitter (Échap)">✕ Quitter</button>
      <canvas id="leo-canvas" width="900" height="600"></canvas>
      <div class="leo-hud" style="display:none;">
        <div class="hud-item">Score: <b id="leo-score">0</b></div>
        <div class="hud-item hud-center">Temps: <b id="leo-time">00:00</b></div>
        <div class="hud-item hud-lives" id="leo-lives">❤❤❤</div>
      </div>
      <div class="leo-level" style="display:none;">Niveau: <b id="leo-lvl">1</b></div>
      <div class="leo-buffs" id="leo-buffs" style="display:none;"></div>
      <div class="leo-screen" id="leo-start">
        <h1>👾  LEO'S MISSION  👾</h1>
        <p>Bienvenue dans l'easter egg ! Défends mon CV.</p>
        <div class="leo-keys">
          <i>Déplacer</i><b>← ↑ ↓ → / ZQSD</b>
          <i>Tirer</i><b>ESPACE</b>
          <i>Pause</i><b>P</b>
          <i>Quitter</i><b>ÉCHAP</b>
        </div>
        <p class="leo-cta">Appuyer sur ESPACE pour démarrer</p>
        <button class="leo-rules-btn" id="leo-rules-btn" title="Afficher les règles (H)">📖 Règles (H)</button>
        <button class="leo-lb-btn" id="leo-lb-btn" title="Voir le classement">🏆 Classement</button>
      </div>
      <div class="leo-rules" id="leo-rules" style="display:none;">
        <div class="leo-rules-inner">
          <button class="leo-rules-close" id="leo-rules-close" title="Fermer (H ou Échap)">✕</button>
          <h2>📖 Règles du jeu</h2>

          <section>
            <h3>Objectif</h3>
            <p>Survis le plus longtemps possible en détruisant les ennemis. La difficulté augmente d'un niveau toutes les 30 secondes. À partir du niveau 6, des élites apparaissent ; à partir du niveau 10, des boss.</p>
          </section>

          <section>
            <h3>Commandes</h3>
            <ul class="leo-rules-keys">
              <li><b>← ↑ ↓ → / ZQSD</b> Déplacement</li>
              <li><b>ESPACE</b> Tirer</li>
              <li><b>P</b> Pause</li>
              <li><b>H</b> Afficher / masquer les règles</li>
              <li><b>ÉCHAP</b> Quitter</li>
            </ul>
          </section>

          <section>
            <h3>❤ Système de vie ❤</h3>
            <p>Tu commences avec <b>3 vies</b>. Tu perds une vie au contact d'un ennemi ou d'un projectile ennemi. Après chaque touche, tu es invincible pendant ~1,5 s (clignotement).</p>
            <p>Tu gagnes une <b>vie bonus tous les 10 000 points</b> (max 9 cœurs affichés). À 0 vie, c'est game over — appuie sur <b>R</b> pour rejouer.</p>
          </section>

          <section>
            <h3>⚡ Power-ups (bonus) ⚡</h3>
            <ul class="leo-rules-list">
              <li>
                <img src="./img/game/pu_double_clean.png" alt="Tir multiple">
                <div><b>Tir multiple</b> — Empile jusqu'à 3 fois : 2× → 4× → 8× tirs simultanés.</div>
              </li>
              <li>
                <img src="./img/game/pu_rapid_clean.png" alt="Cadence rapide">
                <div><b>Cadence rapide</b> — Empile jusqu'à 3 fois, réduit le délai entre les tirs (×0.7 par stack).</div>
              </li>
              <li>
                <img src="./img/game/pu_shield_clean.png" alt="Bouclier">
                <div><b>Bouclier</b> — Absorbe le prochain coup reçu sans perdre de vie.</div>
              </li>
              <li>
                <img src="./img/game/pu_speed_clean.png" alt="Vitesse">
                <div><b>Vitesse +</b> — Augmente la vitesse de déplacement de +0.25 (max ×2.0).</div>
              </li>
            </ul>
          </section>

          <section>
            <h3>☠ Malus (à éviter) ☠</h3>
            <ul class="leo-rules-list">
              <li>
                <img src="./img/game/mal_slow_clean.png" alt="Ralenti">
                <div><b>Ralenti</b> — Diminue la vitesse de déplacement de -0.25 (min ×0.5).</div>
              </li>
              <li>
                <img src="./img/game/mal_weak_clean.png" alt="Tir faible">
                <div><b>Tir faible</b> — Double le délai entre les tirs pendant 8 secondes.</div>
              </li>
              <li>
                <img src="./img/game/mal_divide_clean.png" alt="Réduction de tir">
                <div><b>Réduction de tir</b> — Retire un stack de tir multiple (n'apparaît que si tu en as au moins un).</div>
              </li>
            </ul>
          </section>

          <section>
            <h3>👾 Ennemis 👾</h3>
            <ul class="leo-rules-list compact">
              <li><b>Astéroïde</b> — 1 PV (+1 tous les 5 niveaux), 10 pts. Trajectoire droite.</li>
              <li><b>Chaser</b> — 1 PV (+1 tous les 5 niveaux), 25 pts. Zigzag horizontal (lvl 2+).</li>
              <li><b>Tank</b> — 3 PV (+1 tous les 3 niveaux après apparition), 50 pts. Drift latéral et tire vers le bas (lvl 3+).</li>
              <li><b>Élite</b> — 5 PV (+1 par niveau), 150 pts. Tire des carapaces visées (lvl 6+).</li>
              <li><b>Boss</b> — 24 PV (+4 par niveau), 500 pts. Tire 3 missiles visés (lvl 10+).</li>
            </ul>
          </section>

          <p class="leo-rules-foot">Appuie sur <b>H</b> ou <b>ÉCHAP</b> pour fermer.</p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const rulesPanel = overlay.querySelector('#leo-rules');
    const toggleRules = () => {
      const visible = rulesPanel.style.display !== 'none';
      rulesPanel.style.display = visible ? 'none' : 'flex';
    };
    overlay.querySelector('#leo-rules-btn').addEventListener('click', toggleRules);
    overlay.querySelector('#leo-rules-close').addEventListener('click', toggleRules);
    overlay.querySelector('#leo-lb-btn').addEventListener('click', () => openLeaderboard(overlay));

    const canvas = document.getElementById('leo-canvas');
    const ctx = canvas.getContext('2d');

    // Charger les sprites
    const sprites = {};
    await Promise.all(
      Object.keys(ASSETS).map(async (k) => { sprites[k] = await loadImg(ASSETS[k]); })
    );

    gameInstance = new Game(canvas, ctx, sprites, overlay);
    gameInstance.attach();
  }

  function showMobileMessage() {
    const ov = document.createElement('div');
    ov.id = 'leo-game-overlay';
    ov.innerHTML = `<div class="leo-mobile-msg">🚀 LEO'S MISSION est disponible sur ordinateur uniquement.<br><br>Touche n'importe où pour fermer.</div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', () => ov.remove(), { once: true });
  }

  function cleanupGame() {
    const ov = document.getElementById('leo-game-overlay');
    if (ov) ov.remove();
    document.body.style.overflow = '';
    gameInstance = null;
  }

  // ---------- Écran leaderboard (depuis le menu d'accueil) ----------
  async function openLeaderboard(overlay) {
    let panel = overlay.querySelector('#leo-lb-panel');
    if (panel) { panel.remove(); }
    panel = document.createElement('div');
    panel.id = 'leo-lb-panel';
    panel.className = 'leo-lb-panel';
    panel.innerHTML = `
      <div class="leo-lb-inner">
        <button class="leo-lb-close" title="Fermer">✕</button>
        <h2>🏆 CLASSEMENT — TOP 100</h2>
        <div class="leo-lb-head">
          <span class="leo-lb-rank">#</span>
          <span class="leo-lb-pseudo">Pseudo</span>
          <span class="leo-lb-score">Score</span>
          <span class="leo-lb-time">Temps</span>
          <span class="leo-lb-lvl">Niv.</span>
        </div>
        <div class="leo-lb-list" id="leo-lb-list">
          <div class="leo-lb-loading">Chargement…</div>
        </div>
      </div>
    `;
    overlay.appendChild(panel);
    panel.querySelector('.leo-lb-close').addEventListener('click', () => panel.remove());
    try {
      const rows = await fetchTop(100);
      panel.querySelector('#leo-lb-list').innerHTML = renderLeaderboardRows(rows);
    } catch (err) {
      panel.querySelector('#leo-lb-list').innerHTML = `<div class="leo-lb-empty">Impossible de charger le classement.</div>`;
    }
  }

  // ---------- Game ----------
  class Game {
    constructor(canvas, ctx, sprites, overlay) {
      this.canvas = canvas;
      this.ctx = ctx;
      this.sprites = sprites;
      this.overlay = overlay;
      this.W = canvas.width;
      this.H = canvas.height;

      this.state = 'start'; // 'start' | 'play' | 'pause' | 'over'
      this.keys = new Set();
      this.menuBuffer = '';      // tampon code secret sur le menu
      this.startAtLevel10 = false;
      this.lastT = 0;
      this.elapsed = 0; // ms écoulées en jeu
      this.spawnAcc = 0;
      this.enemyShotAcc = 0;

      this.player = null;
      this.bullets = [];
      this.enemies = [];
      this.eBullets = [];
      this.particles = [];
      this.stars = [];
      this.pickups = [];
      this.puSpawnAcc = 0;
      this.malSpawnAcc = 0;

      this.score = 0;
      this.lives = 3;
      this.difficulty = 1;

      this.initStars();
    }

    initStars() {
      for (let i = 0; i < 120; i++) {
        this.stars.push({
          x: Math.random() * this.W,
          y: Math.random() * this.H,
          s: Math.random() * 1.6 + 0.3,
          v: Math.random() * 40 + 20,
        });
      }
    }

    resetPlay() {
      this.player = {
        x: this.W / 2,
        y: this.H - 70,
        w: 48, h: 48,
        speed: 320,
        cooldown: 0,
        invuln: 0,
        effects: {
          doubleStacks: 0,   // 0..3 → 1, 2, 4, 8 tirs
          rapidStacks: 0,    // 0..3 → cadence × 0.7^stacks
          shield: false,
          speedMul: 1,       // 0.5..2.0 par paliers de 0.25 (speed power-up / slow malus)
          weak: 0,           // timer (malus temporaire)
        },
      };
      this.bullets = [];
      this.enemies = [];
      this.eBullets = [];
      this.particles = [];
      this.pickups = [];
      this.score = 0;
      this.lives = 3;
      this.nextLifeAt = 10000;
      this.difficulty = 1;
      this.lastBossLevel = 0; // dernier niveau où un boss a spawn
      this.elapsed = 0;
      this.spawnAcc = 0;
      this.enemyShotAcc = 0;
      this.puSpawnAcc = 0;
      this.malSpawnAcc = 0;
    }

    attach() {
      this._onKeyDown = (e) => this.onKeyDown(e);
      this._onKeyUp = (e) => this.onKeyUp(e);
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      this.overlay.querySelector('.leo-quit').addEventListener('click', () => this.quit());
      this.lastT = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    detach() {
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
    }

    quit() {
      this.detach();
      cleanupGame();
    }

    onKeyDown(e) {
      const k = (e.key || '').toLowerCase();
      this.keys.add(k);

      // panneau des règles (uniquement depuis le menu d'accueil)
      const rulesPanel = this.overlay.querySelector('#leo-rules');
      const rulesOpen = rulesPanel && rulesPanel.style.display !== 'none';
      if (this.state === 'start' && k === 'h') {
        if (rulesPanel) rulesPanel.style.display = rulesOpen ? 'none' : 'flex';
        e.preventDefault();
        return;
      }
      if (this.state === 'start' && rulesOpen && k === 'escape') {
        rulesPanel.style.display = 'none';
        e.preventDefault();
        return;
      }
      // bloque le démarrage tant que les règles sont ouvertes
      if (this.state === 'start' && rulesOpen && k === ' ') {
        e.preventDefault();
        return;
      }

      if (k === 'escape') { this.quit(); e.preventDefault(); return; }

      // code secret sur le menu : "true42" → démarre directement au niveau 10
      if (this.state === 'start' && k.length === 1) {
        const CODE = 'true42';
        this.menuBuffer = (this.menuBuffer + k).slice(-CODE.length);
        if (this.menuBuffer === CODE) {
          this.startAtLevel10 = true;
          this.menuBuffer = '';
          const cta = document.querySelector('#leo-start .leo-cta');
          if (cta) cta.textContent = '★ CODE ACCEPTÉ — ESPACE pour démarrer au niveau 10 ★';
        }
      }

      if (this.state === 'start' && k === ' ') {
        this.state = 'play';
        this.resetPlay();
        if (this.startAtLevel10) {
          // amène directement au niveau 10 (difficulty = 1 + floor(s/25) → s ≥ 225)
          this.elapsed = 225 * 1000;
          this.difficulty = 10;
          // tous les power-ups au max
          const ef = this.player.effects;
          ef.doubleStacks = 3;
          ef.rapidStacks = 3;
          ef.shield = true;
          ef.speedMul = 2;
          this.startAtLevel10 = false;
        }
        const startScreen = document.getElementById('leo-start');
        if (startScreen) startScreen.remove();
        this.overlay.querySelector('.leo-hud').style.display = 'flex';
        this.overlay.querySelector('.leo-level').style.display = 'block';
        e.preventDefault();
        return;
      }

      if (this.state === 'play' && k === 'p') {
        this.state = 'pause';
        this.showOverlayScreen('pause', 'PAUSE', 'P pour reprendre');
        e.preventDefault();
        return;
      }

      if (this.state === 'pause' && k === 'p') {
        this.state = 'play';
        this.removeOverlayScreen();
        this.lastT = performance.now();
        e.preventDefault();
        return;
      }

      if (this.state === 'over' && k === 'r') {
        this.state = 'play';
        this.resetPlay();
        this.removeOverlayScreen();
        this.overlay.querySelector('.leo-hud').style.display = 'flex';
        this.overlay.querySelector('.leo-level').style.display = 'block';
        this.lastT = performance.now();
        e.preventDefault();
        return;
      }

      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
      }
    }

    onKeyUp(e) {
      this.keys.delete((e.key || '').toLowerCase());
    }

    showOverlayScreen(id, title, sub, extra = '') {
      this.removeOverlayScreen();
      const s = document.createElement('div');
      s.className = 'leo-screen';
      s.id = 'leo-screen-' + id;
      s.innerHTML = `<h2>${title}</h2><p>${sub}</p>${extra}`;
      this.overlay.appendChild(s);
    }

    removeOverlayScreen() {
      const s = this.overlay.querySelector('.leo-screen');
      if (s) s.remove();
    }

    loop(t) {
      if (!gameInstance) return; // jeu fermé
      const dt = Math.min(0.05, (t - this.lastT) / 1000);
      this.lastT = t;
      if (this.state === 'play') this.update(dt);
      this.render();
      requestAnimationFrame((t2) => this.loop(t2));
    }

    update(dt) {
      this.elapsed += dt * 1000;
      const seconds = this.elapsed / 1000;
      this.difficulty = 1 + Math.floor(seconds / 30);

      // étoiles
      for (const s of this.stars) {
        s.y += s.v * dt;
        if (s.y > this.H) { s.y = 0; s.x = Math.random() * this.W; }
      }

      // input joueur
      const p = this.player;
      const ef = p.effects;
      // décompte des effets temporaires (malus)
      if (ef.weak > 0) ef.weak -= dt;

      let dx = 0, dy = 0;
      if (this.keys.has('arrowleft') || this.keys.has('q') || this.keys.has('a')) dx -= 1;
      if (this.keys.has('arrowright') || this.keys.has('d')) dx += 1;
      if (this.keys.has('arrowup') || this.keys.has('z') || this.keys.has('w')) dy -= 1;
      if (this.keys.has('arrowdown') || this.keys.has('s')) dy += 1;
      const len = Math.hypot(dx, dy) || 1;
      const speedMul = ef.speedMul;
      p.x += (dx / len) * p.speed * speedMul * dt;
      p.y += (dy / len) * p.speed * speedMul * dt;
      p.x = Math.max(p.w / 2, Math.min(this.W - p.w / 2, p.x));
      p.y = Math.max(p.h / 2, Math.min(this.H - p.h / 2, p.y));

      // tir joueur (stacks de power-ups + malus temporaires)
      p.cooldown -= dt;
      if (this.keys.has(' ') && p.cooldown <= 0) {
        const y0 = p.y - p.h / 2;
        const n = 1 << ef.doubleStacks; // 1, 2, 4, 8
        if (n === 1) {
          this.bullets.push({ x: p.x, y: y0, vy: -560, w: 16, h: 28 });
        } else {
          const spread = 10 * (n - 1); // largeur totale du peigne
          for (let i = 0; i < n; i++) {
            const offset = -spread / 2 + i * (spread / (n - 1));
            this.bullets.push({ x: p.x + offset, y: y0, vy: -560, w: 16, h: 28 });
          }
        }
        let cd = 0.18 * Math.pow(0.7, ef.rapidStacks);
        if (ef.weak > 0) cd *= 2;
        p.cooldown = cd;
      }
      if (p.invuln > 0) p.invuln -= dt;

      // mouvement balles
      for (const b of this.bullets) b.y += b.vy * dt;
      this.bullets = this.bullets.filter((b) => b.y > -20);

      // spawn ennemis
      const spawnInterval = Math.max(0.3, 1.2 - this.difficulty * 0.08);
      this.spawnAcc += dt;
      if (this.spawnAcc >= spawnInterval && this.enemies.length < 40) {
        this.spawnAcc = 0;
        this.spawnEnemy();
      }

      // mouvement ennemis
      for (const e of this.enemies) {
        if (e.hitFlash > 0) e.hitFlash -= dt;
        e.y += e.vy * dt;
        if (e.type === 'chaser') {
          e.x += Math.sin((e.y + e.phase) * 0.02) * 80 * dt;
        } else if (e.type === 'tank') {
          // drift latéral avec rebond sur les murs
          e.x += e.vx * dt;
          if (e.x < e.w / 2) { e.x = e.w / 2; e.vx = -e.vx; }
          else if (e.x > this.W - e.w / 2) { e.x = this.W - e.w / 2; e.vx = -e.vx; }
        } else if (e.type === 'boss') {
          // descente puis stationnement en haut + zigzag horizontal
          if (e.y < 90) { /* continue à descendre */ }
          else { e.vy = 0; }
          e.x += e.vx * dt;
          if (e.x < e.w / 2) { e.x = e.w / 2; e.vx = -e.vx; }
          else if (e.x > this.W - e.w / 2) { e.x = this.W - e.w / 2; e.vx = -e.vx; }
          // tir : 3 missiles visés vers le joueur avec arc latéral
          e.shootT -= dt;
          if (e.shootT <= 0) {
            const dxB = this.player.x - e.x;
            const dyB = this.player.y - (e.y + e.h / 2);
            const ang = Math.atan2(dyB, dxB);
            const sp = 280;
            const spread = 0.22; // ~12.5° de chaque côté
            for (const da of [-spread, 0, spread]) {
              const a = ang + da;
              this.eBullets.push({
                x: e.x, y: e.y + e.h / 2,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                w: 18, h: 28, aimed: true,
              });
            }
            e.shootT = Math.max(0.8, 1.8 - this.difficulty * 0.06);
          }
        } else if (e.type === 'elite') {
          // descend lentement, drift latéral, tire une carapace visée (cadence lente)
          e.x += e.vx * dt;
          if (e.x < e.w / 2) { e.x = e.w / 2; e.vx = -e.vx; }
          else if (e.x > this.W - e.w / 2) { e.x = this.W - e.w / 2; e.vx = -e.vx; }
          e.shootT -= dt;
          if (e.shootT <= 0) {
            const dxB = this.player.x - e.x;
            const dyB = this.player.y - e.y;
            const dB = Math.hypot(dxB, dyB) || 1;
            const sp = 240;
            this.eBullets.push({
              kind: 'carapace',
              x: e.x, y: e.y + e.h / 2,
              vx: (dxB / dB) * sp, vy: (dyB / dB) * sp,
              w: 20, h: 20,
              hitW: 14, hitH: 14,
              aimed: true,
              frame: 0,
              frameT: 0,
            });
            e.shootT = Math.max(1.6, 3.2 - this.difficulty * 0.08);
          }
        }
      }
      // ne pas retirer le boss tant qu'il est vivant
      this.enemies = this.enemies.filter((e) => e.type === 'boss' || e.y < this.H + 60);

      // tir tanks
      this.enemyShotAcc += dt;
      const tankShotInterval = this.difficulty >= 5 ? 0.6 : 1.2;
      if (this.enemyShotAcc >= tankShotInterval) {
        this.enemyShotAcc = 0;
        for (const e of this.enemies) {
          if (e.type === 'tank' && Math.random() < 0.5) {
            this.eBullets.push({ x: e.x, y: e.y + e.h / 2, vy: 260, w: 16, h: 28 });
          }
        }
      }

      // mouvement tirs ennemis (les tirs visés ont aussi un vx)
      for (const b of this.eBullets) {
        b.y += b.vy * dt;
        if (b.vx) b.x += b.vx * dt;
        // animation carapace (4 frames @ ~12 fps)
        if (b.kind === 'carapace') {
          b.frameT = (b.frameT || 0) + dt;
          if (b.frameT >= 0.08) {
            b.frameT -= 0.08;
            b.frame = ((b.frame || 0) + 1) % 4;
          }
        }
      }
      this.eBullets = this.eBullets.filter((b) =>
        b.y < this.H + 20 && b.y > -20 && b.x > -20 && b.x < this.W + 20
      );

      // spawn power-ups (rare) et malus (très rare)
      this.puSpawnAcc += dt;
      this.malSpawnAcc += dt;
      const PU_INTERVAL = 14;   // toutes ~14s, tentative
      const MAL_INTERVAL = 28;  // toutes ~28s, tentative
      if (this.puSpawnAcc >= PU_INTERVAL) {
        this.puSpawnAcc = 0;
        if (Math.random() < 0.7) this.spawnPickup(false);
      }
      if (this.malSpawnAcc >= MAL_INTERVAL) {
        this.malSpawnAcc = 0;
        if (Math.random() < 0.4) this.spawnPickup(true);
      }

      // mouvement pickups
      for (const u of this.pickups) u.y += u.vy * dt;
      this.pickups = this.pickups.filter((u) => u.y < this.H + 30);

      // collision joueur <-> pickups
      for (const u of this.pickups) {
        if (this.hit(p, u)) {
          this.applyPickup(u);
          u.dead = true;
        }
      }
      this.pickups = this.pickups.filter((u) => !u.dead);

      // collisions balles joueur -> ennemis
      for (const b of this.bullets) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (this.hit(b, e)) {
            b.dead = true;
            e.hp -= 1;
            e.hitFlash = 0.18;
            if (e.hp <= 0) {
              e.dead = true;
              this.score += e.points;
              const n = e.type === 'boss' ? 80 : e.type === 'elite' ? 45 : e.type === 'tank' ? 30 : 16;
              this.explode(e.x, e.y, n);
            }
            break;
          }
        }
      }
      this.bullets = this.bullets.filter((b) => !b.dead);
      this.enemies = this.enemies.filter((e) => !e.dead);

      // vie bonus tous les 10 000 points (cap à 9 cœurs pour l'affichage)
      while (this.score >= this.nextLifeAt) {
        if (this.lives < 9) this.lives += 1;
        this.nextLifeAt += 10000;
      }

      // collisions ennemis -> joueur (le boss ne meurt pas au contact)
      if (p.invuln <= 0) {
        for (const e of this.enemies) {
          if (this.hit(p, e)) {
            this.hurt();
            if (e.type !== 'boss') { e.dead = true; this.explode(e.x, e.y, 16); }
            break;
          }
        }
        for (const b of this.eBullets) {
          if (this.hit(p, b)) { this.hurt(); b.dead = true; break; }
        }
      }
      this.enemies = this.enemies.filter((e) => !e.dead);
      this.eBullets = this.eBullets.filter((b) => !b.dead);

      // particules
      for (const pa of this.particles) {
        pa.x += pa.vx * dt;
        pa.y += pa.vy * dt;
        pa.life -= dt;
      }
      this.particles = this.particles.filter((pa) => pa.life > 0);

      // HUD
      this.updateHUD();
    }

    spawnEnemy() {
      const d = this.difficulty;
      const bossAlive = this.enemies.some((e) => e.type === 'boss');

      // Boss : à partir du niveau 10, au moins 1 garanti par niveau, taux croissant ensuite.
      if (d >= 10 && !bossAlive) {
        const guaranteed = d > this.lastBossLevel;
        // taux : 4% au lvl 10, +1% par niveau au-delà (cap 12%)
        const chance = Math.min(0.12, 0.04 + (d - 10) * 0.01);
        if (guaranteed || Math.random() < chance) {
          const hp = 24 + (d - 10) * 4;
          this.enemies.push({
            type: 'boss',
            x: this.W / 2, y: -60,
            w: 96, h: 96,
            hitW: 70, hitH: 72, // hitbox resserrée sur le vaisseau (sprite avec padding)
            vy: 40,
            vx: 90 * (Math.random() < 0.5 ? -1 : 1),
            hp, maxHp: hp,
            points: 500,
            dead: false,
            phase: Math.random() * 1000,
            shootT: 1.5,
            hitFlash: 0,
          });
          this.lastBossLevel = d;
          return;
        }
      }

      // Elite (mini-boss) : à partir du niveau 6, remplace l'ancien rôle du boss
      // Tire visé sur le joueur, descend en drift, max 2 simultanés.
      const eliteCount = this.enemies.filter((e) => e.type === 'elite').length;
      if (d >= 6 && eliteCount < 2 && Math.random() < 0.07) {
        const hp = 5 + (d - 6);
        this.enemies.push({
          type: 'elite',
          x: Math.random() * (this.W - 80) + 40,
          y: -50,
          w: 64, h: 64,
          hitW: 46, hitH: 48,
          vy: 50 + d * 2,
          vx: (50 + Math.random() * 40) * (Math.random() < 0.5 ? -1 : 1),
          hp, maxHp: hp,
          points: 150,
          dead: false,
          phase: Math.random() * 1000,
          shootT: 1.2,
          hitFlash: 0,
        });
        return;
      }

      const roll = Math.random();
      let type = 'asteroid';
      if (d >= 3 && roll < 0.18) type = 'tank';
      else if (d >= 2 && roll < 0.5) type = 'chaser';

      const baseSpeed = 80 * (1 + d * 0.12);
      let e = {
        type, x: 0, y: -40, w: 40, h: 40, hp: 1, points: 10, dead: false,
        phase: Math.random() * 1000, vx: 0,
      };
      if (type === 'asteroid') { e.w = 40; e.h = 40; e.vy = baseSpeed + Math.random() * 40; e.hp = 1 + Math.floor(d / 5); e.points = 10; }
      else if (type === 'chaser') { e.w = 36; e.h = 36; e.hitW = 28; e.hitH = 28; e.vy = baseSpeed * 1.2 + Math.random() * 40; e.hp = 1 + Math.floor(d / 5); e.points = 25; }
      else if (type === 'tank') {
        e.w = 56; e.h = 56; e.hitW = 44; e.hitH = 44; e.vy = baseSpeed * 0.6; e.hp = 3 + Math.floor((d - 3) / 3); e.points = 50;
        e.vx = (60 + Math.random() * 60) * (Math.random() < 0.5 ? -1 : 1);
      }
      e.hitFlash = 0;
      e.x = Math.random() * (this.W - e.w) + e.w / 2;
      this.enemies.push(e);
    }

    hit(a, b) {
      const aw = a.hitW != null ? a.hitW : a.w;
      const ah = a.hitH != null ? a.hitH : a.h;
      const bw = b.hitW != null ? b.hitW : b.w;
      const bh = b.hitH != null ? b.hitH : b.h;
      return Math.abs(a.x - b.x) < (aw + bw) / 2 && Math.abs(a.y - b.y) < (ah + bh) / 2;
    }

    explode(x, y, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 180;
        this.particles.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.4 + Math.random() * 0.4, color: Math.random() < 0.5 ? '#ffaa00' : '#ff5500',
        });
      }
    }

    hurt() {
      // bouclier absorbe le coup
      if (this.player.effects.shield) {
        this.player.effects.shield = false;
        this.player.invuln = 0.8;
        this.explode(this.player.x, this.player.y, 18);
        return;
      }
      this.lives -= 1;
      this.player.invuln = 1.5;
      this.explode(this.player.x, this.player.y, 24);
      if (this.lives <= 0) this.gameOver();
    }

    spawnPickup(isMalus) {
      let pool;
      if (isMalus) {
        pool = [{ k: 'slow', sprite: 'malSlow' }, { k: 'weak', sprite: 'malWeak' }];
        // le malus "divide" n'apparaît que si le joueur a au moins 1 stack de doubleShot
        if (this.player.effects.doubleStacks > 0) {
          pool.push({ k: 'divide', sprite: 'malDivide' });
          pool.push({ k: 'divide', sprite: 'malDivide' }); // poids accru
        }
      } else {
        pool = [{ k: 'doubleShot', sprite: 'puDouble' },
                { k: 'rapidFire', sprite: 'puRapid' },
                { k: 'shield', sprite: 'puShield' },
                { k: 'speed', sprite: 'puSpeed' }];
      }
      const choice = pool[Math.floor(Math.random() * pool.length)];
      this.pickups.push({
        kind: choice.k,
        sprite: choice.sprite,
        isMalus,
        x: 40 + Math.random() * (this.W - 80),
        y: -30,
        w: 32, h: 32,
        vy: 100,
        dead: false,
      });
    }

    applyPickup(u) {
      const ef = this.player.effects;
      // Power-ups (stacks infinis mais cap)
      if (u.kind === 'doubleShot') {
        if (ef.doubleStacks < 3) ef.doubleStacks += 1;
        // au cap : pickup ignoré (mais consommé visuellement)
      } else if (u.kind === 'rapidFire') {
        if (ef.rapidStacks < 3) ef.rapidStacks += 1;
      } else if (u.kind === 'shield') {
        ef.shield = true;
      } else if (u.kind === 'speed') {
        // +0.25 jusqu'à 2.0 ; si déjà au cap, pickup ignoré
        ef.speedMul = Math.min(2, Math.round((ef.speedMul + 0.25) * 100) / 100);
      }
      // Malus
      else if (u.kind === 'slow') {
        // -0.25 jusqu'à 0.5 minimum
        ef.speedMul = Math.max(0.5, Math.round((ef.speedMul - 0.25) * 100) / 100);
      }
      else if (u.kind === 'weak') ef.weak = 8;
      else if (u.kind === 'divide') {
        if (ef.doubleStacks > 0) ef.doubleStacks -= 1;
      }
      this.explode(u.x, u.y, 10);
    }

    gameOver() {
      this.state = 'over';
      const secs = Math.floor(this.elapsed / 1000);
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      const savedPseudo = (() => { try { return localStorage.getItem('leoPseudo') || ''; } catch (_) { return ''; } })();
      const extra = `
        <p style="margin-top:20px;">Score final : <b style="color:#00e5ff;">${this.score}</b></p>
        <p>Temps de survie : <b style="color:#00e5ff;">${mm}:${ss}</b></p>
        <p>Niveau atteint : <b style="color:#00e5ff;">${this.difficulty}</b></p>
        <div class="leo-submit" id="leo-submit">
          <label for="leo-pseudo">Ton pseudo (max 12) :</label>
          <div class="leo-submit-row">
            <input type="text" id="leo-pseudo" maxlength="12" placeholder="PILOTE" value="${escapeHTML(savedPseudo)}" autocomplete="off">
            <button id="leo-submit-btn">Enregistrer mon score</button>
          </div>
          <p class="leo-submit-msg" id="leo-submit-msg"></p>
        </div>
        <p class="leo-cta" style="margin-top:18px;">R pour rejouer — ÉCHAP pour quitter</p>
        <div class="leo-credit">
          <span class="leo-credit-line"></span>
          <p>✦ Easter egg conçu &amp; développé par <b>Mathéo Desprez</b> ✦</p>
          <p class="leo-credit-sub">Merci d'avoir joué à <b>LEO'S MISSION</b> 🚀</p>
        </div>
      `;
      this.showOverlayScreen('over', 'GAME OVER', 'Ta mission s\'arrête ici.', extra);

      const input = document.getElementById('leo-pseudo');
      const btn = document.getElementById('leo-submit-btn');
      const msg = document.getElementById('leo-submit-msg');
      const score = this.score;
      const timeSeconds = secs;
      const lvl = this.difficulty;
      const overlay = this.overlay;

      // empêche que la touche R/ESPACE soit captée pendant la saisie
      if (input) {
        input.addEventListener('keydown', (e) => e.stopPropagation());
      }

      const onSubmit = async () => {
        const pseudo = (input.value || '').trim();
        if (pseudo.length < 1) {
          msg.textContent = 'Entre un pseudo (1 à 12 caractères).';
          msg.className = 'leo-submit-msg err';
          return;
        }
        btn.disabled = true;
        msg.textContent = 'Envoi…';
        msg.className = 'leo-submit-msg';
        try {
          await submitScore(pseudo, score, timeSeconds, lvl);
          try { localStorage.setItem('leoPseudo', pseudo); } catch (_) {}
          msg.textContent = 'Score enregistré !';
          msg.className = 'leo-submit-msg ok';
          // ouvre le classement avec la ligne du joueur surlignée
          const panel = document.createElement('div');
          panel.id = 'leo-lb-panel';
          panel.className = 'leo-lb-panel';
          panel.innerHTML = `
            <div class="leo-lb-inner">
              <button class="leo-lb-close" title="Fermer">✕</button>
              <h2>🏆 CLASSEMENT — TOP 100</h2>
              <div class="leo-lb-head">
                <span class="leo-lb-rank">#</span>
                <span class="leo-lb-pseudo">Pseudo</span>
                <span class="leo-lb-score">Score</span>
                <span class="leo-lb-time">Temps</span>
                <span class="leo-lb-lvl">Niv.</span>
              </div>
              <div class="leo-lb-list" id="leo-lb-list">
                <div class="leo-lb-loading">Chargement…</div>
              </div>
            </div>
          `;
          overlay.appendChild(panel);
          panel.querySelector('.leo-lb-close').addEventListener('click', () => panel.remove());
          try {
            const rows = await fetchTop(100);
            panel.querySelector('#leo-lb-list').innerHTML = renderLeaderboardRows(rows, { pseudo, score, timeSeconds });
            // auto-scroll vers ma ligne si présente
            const me = panel.querySelector('.leo-lb-row.me');
            if (me) me.scrollIntoView({ block: 'center' });
          } catch (_) {
            panel.querySelector('#leo-lb-list').innerHTML = `<div class="leo-lb-empty">Impossible de charger le classement.</div>`;
          }
        } catch (err) {
          msg.textContent = 'Erreur d\'envoi. Réessaie.';
          msg.className = 'leo-submit-msg err';
          btn.disabled = false;
        }
      };
      if (btn) btn.addEventListener('click', onSubmit);
      if (input) input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); onSubmit(); }
      });
    }

    updateHUD() {
      document.getElementById('leo-score').textContent = this.score;
      const secs = Math.floor(this.elapsed / 1000);
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      document.getElementById('leo-time').textContent = `${mm}:${ss}`;
      document.getElementById('leo-lives').textContent = '❤'.repeat(Math.max(0, this.lives));
      document.getElementById('leo-lvl').textContent = this.difficulty;

      // affichage des buffs/malus actifs
      const buffsEl = document.getElementById('leo-buffs');
      const ef = this.player.effects;
      const items = [];
      if (ef.doubleStacks > 0) {
        const n = 1 << ef.doubleStacks; // 2, 4, 8
        items.push({ label: `${n}x TIR`, malus: false });
      }
      if (ef.rapidStacks > 0) items.push({ label: `CADENCE ×${ef.rapidStacks}`, malus: false });
      if (ef.shield) items.push({ label: 'BOUCLIER', malus: false });
      if (ef.speedMul > 1) items.push({ label: `VITESSE ×${ef.speedMul.toFixed(2)}`, malus: false });
      else if (ef.speedMul < 1) items.push({ label: `RALENTI ×${ef.speedMul.toFixed(2)}`, malus: true });
      if (ef.weak > 0) items.push({ label: `TIR FAIBLE ${ef.weak.toFixed(1)}s`, malus: true });
      if (items.length === 0) {
        buffsEl.style.display = 'none';
        buffsEl.innerHTML = '';
      } else {
        buffsEl.style.display = 'flex';
        buffsEl.innerHTML = items
          .map((it) => `<div class="buff${it.malus ? ' malus' : ''}">${it.label}</div>`)
          .join('');
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.W, this.H);

      // fond étoilé
      ctx.fillStyle = '#000018';
      ctx.fillRect(0, 0, this.W, this.H);
      for (const s of this.stars) {
        ctx.globalAlpha = 0.4 + s.s / 4;
        ctx.fillStyle = '#fff';
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      ctx.globalAlpha = 1;

      // ennemis
      for (const e of this.enemies) {
        const spriteKey = e.type === 'asteroid' ? 'asteroid'
                        : e.type === 'chaser' ? 'chaser'
                        : e.type === 'boss' ? 'boss'
                        : e.type === 'elite' ? 'elite'
                        : 'tank';
        const img = this.sprites[spriteKey];
        if (img) ctx.drawImage(img, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
        // flash de hit : re-dessine le sprite plusieurs fois en additif pour le faire briller
        if (e.hitFlash > 0 && img) {
          const t = Math.min(1, e.hitFlash / 0.18);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = t;
          ctx.drawImage(img, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
          ctx.drawImage(img, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
          ctx.drawImage(img, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
          ctx.restore();
        }
        // barre de vie boss + elite
        if (e.type === 'boss' || e.type === 'elite') {
          const bw = e.type === 'boss' ? 80 : 50, bh = e.type === 'boss' ? 6 : 4;
          const ratio = Math.max(0, e.hp / e.maxHp);
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(e.x - bw / 2, e.y - e.h / 2 - 14, bw, bh);
          ctx.fillStyle = ratio > 0.5 ? '#00ff88' : ratio > 0.25 ? '#ffaa00' : '#ff3344';
          ctx.fillRect(e.x - bw / 2, e.y - e.h / 2 - 14, bw * ratio, bh);
        }
      }

      // pickups (légère oscillation)
      for (const u of this.pickups) {
        const img = this.sprites[u.sprite];
        if (img) {
          const bob = Math.sin((u.y + u.x) * 0.05) * 2;
          ctx.drawImage(img, u.x - u.w / 2, u.y - u.h / 2 + bob, u.w, u.h);
        }
      }

      // balles
      for (const b of this.bullets) {
        if (this.sprites.bulletPlayer) {
          ctx.drawImage(this.sprites.bulletPlayer, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
        }
      }
      for (const b of this.eBullets) {
        if (b.kind === 'carapace') {
          const f = b.frame || 0;
          const img = this.sprites['carapace' + f];
          if (img) ctx.drawImage(img, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
        } else if (this.sprites.bulletEnemy) {
          const vx = b.vx || 0;
          const vy = b.vy || 0;
          if (vx !== 0) {
            const angle = Math.atan2(-vx, vy);
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(angle);
            ctx.drawImage(this.sprites.bulletEnemy, -b.w / 2, -b.h / 2, b.w, b.h);
            ctx.restore();
          } else {
            ctx.drawImage(this.sprites.bulletEnemy, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
          }
        }
      }

      // joueur
      if (this.player && this.state !== 'start') {
        const p = this.player;
        const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
        if (!blink && this.sprites.player) {
          ctx.drawImage(this.sprites.player, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
        }
        // halo bouclier
        if (p.effects.shield) {
          ctx.strokeStyle = '#00ffee';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.7 + Math.sin(this.elapsed * 0.01) * 0.3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.w * 0.7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // particules
      for (const pa of this.particles) {
        ctx.globalAlpha = Math.max(0, pa.life);
        ctx.fillStyle = pa.color;
        ctx.fillRect(pa.x - 2, pa.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
    }
  }
})();
