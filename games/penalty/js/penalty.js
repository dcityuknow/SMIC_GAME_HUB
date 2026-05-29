'use strict';

// ── CONFIG ──────────────────────────────────────────────
const TOTAL_ROUNDS = 5;

// Keeper AI: probability of diving to the correct zone
// (increases each round slightly to feel harder)
const KEEPER_ACCURACY = [0.35, 0.40, 0.45, 0.45, 0.50];

// Bot shooter: zones it prefers (weighted random)
const BOT_SHOT_WEIGHTS = [2,1,2, 1,0,1, 3,1,3]; // bottom corners preferred

// Zone → CSS position inside .goal-net  (left%, bottom%)
const ZONE_POS = [
    { l:16, b:72 }, { l:50, b:72 }, { l:84, b:72 },  // top row
    { l:16, b:50 }, { l:50, b:50 }, { l:84, b:50 },  // mid row
    { l:16, b:16 }, { l:50, b:16 }, { l:84, b:16 },  // bottom row
];

// ── STATE ───────────────────────────────────────────────
let mode        = 'shooter'; // 'shooter' | 'keeper'
let round       = 0;
let playerScore = 0;
let botScore    = 0;
let playerHistory = []; // 'goal' | 'miss'
let botHistory    = [];
let busy        = false;  // prevent double clicks during animation

// ── DOM REFS ────────────────────────────────────────────
const screenMode   = document.getElementById('screenMode');
const screenGame   = document.getElementById('screenGame');
const screenResult = document.getElementById('screenResult');

const playerScoreEl = document.getElementById('playerScore');
const botScoreEl    = document.getElementById('botScore');
const playerDotsEl  = document.getElementById('playerDots');
const botDotsEl     = document.getElementById('botDots');
const sbRoundEl     = document.getElementById('sbRound');
const playerLabel   = document.getElementById('playerLabel');

const keeper       = document.getElementById('keeper');
const ball         = document.getElementById('ball');
const shooterSprite= document.getElementById('shooterSprite');
const zones        = document.querySelectorAll('.zone');
const shotGrid     = document.getElementById('shotGrid');
const actionHint   = document.getElementById('actionHint');
const resultFlash  = document.getElementById('resultFlash');

const resultTrophy = document.getElementById('resultTrophy');
const resultTitle  = document.getElementById('resultTitle');
const resultSub    = document.getElementById('resultSub');

// ── SCREENS ─────────────────────────────────────────────
function showScreen(id) {
    [screenMode, screenGame, screenResult].forEach(s => {
        s.classList.toggle('hidden', s.id !== id);
    });
}

// ── START GAME ──────────────────────────────────────────
function startGame(selectedMode) {
    mode = selectedMode;
    round = 0;
    playerScore = 0;
    botScore = 0;
    playerHistory = [];
    botHistory    = [];
    busy = false;

    playerLabel.textContent = mode === 'shooter' ? 'YOU SHOOT' : 'YOU SAVE';
    updateScoreboard();
    resetBallAndKeeper();
    buildActionPanel();
    showScreen('screenGame');
    setTimeout(beginRound, 400);
}

// ── SCOREBOARD ──────────────────────────────────────────
function updateScoreboard() {
    playerScoreEl.textContent = playerScore;
    botScoreEl.textContent    = botScore;
    sbRoundEl.textContent     = round < TOTAL_ROUNDS
        ? `ROUND ${round + 1}/${TOTAL_ROUNDS}`
        : 'FINAL';

    renderDots(playerDotsEl, playerHistory);
    renderDots(botDotsEl,    botHistory);
}

function renderDots(container, history) {
    container.innerHTML = '';
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
        const d = document.createElement('div');
        d.className = 'dot' + (history[i] ? ' ' + history[i] : '');
        container.appendChild(d);
    }
}

// ── ACTION PANEL ────────────────────────────────────────
function buildActionPanel() {
    // Remove old dive buttons if any
    const old = document.querySelector('.dive-row');
    if (old) old.remove();

    if (mode === 'shooter') {
        shotGrid.style.display = 'grid';
        actionHint.textContent = 'Choose where to shoot!';
        zones.forEach(z => {
            z.onclick = () => handleShooterClick(parseInt(z.dataset.zone));
        });
        // also wire arrow buttons
        document.querySelectorAll('.shot-btn').forEach(btn => {
            btn.onclick = () => handleShooterClick(parseInt(btn.dataset.zone));
        });
    } else {
        shotGrid.style.display = 'none';
        actionHint.textContent = 'Dive to block the shot!';
        zones.forEach(z => { z.onclick = () => handleKeeperClick(parseInt(z.dataset.zone)); });
        // Build dive direction buttons
        const row = document.createElement('div');
        row.className = 'dive-row';
        [['⬅ DIVE LEFT','left'], ['⬆ DIVE HIGH','top'], ['➡ DIVE RIGHT','right']].forEach(([label, dir]) => {
            const b = document.createElement('button');
            b.className = 'dive-btn';
            b.textContent = label;
            b.dataset.dir = dir;
            b.onclick = () => handleKeeperDive(dir);
            row.appendChild(b);
        });
        document.querySelector('.action-panel').appendChild(row);
    }
}

function setInputEnabled(on) {
    zones.forEach(z => z.style.pointerEvents = on ? 'auto' : 'none');
    document.querySelectorAll('.shot-btn, .dive-btn').forEach(b => {
        b.classList.toggle('disabled', !on);
    });
}

// ── ROUND FLOW ──────────────────────────────────────────
function beginRound() {
    if (round >= TOTAL_ROUNDS) { endGame(); return; }
    busy = false;
    resetBallAndKeeper();
    clearZoneHighlights();
    updateScoreboard();
    setInputEnabled(true);
    resultFlash.classList.add('hidden');
}

// ── SHOOTER MODE ────────────────────────────────────────
function handleShooterClick(zone) {
    if (busy) return;
    busy = true;
    setInputEnabled(false);

    const keeperZone = botKeeperDecide(round);
    animateShot(zone, keeperZone, (isGoal) => {
        if (isGoal) { playerScore++; playerHistory.push('goal'); }
        else        { playerHistory.push('miss'); }

        // Bot shoots back
        setTimeout(() => {
            botShoot((botGoal) => {
                if (botGoal) { botScore++; botHistory.push('goal'); }
                else         { botHistory.push('miss'); }
                round++;
                updateScoreboard();
                setTimeout(beginRound, 900);
            });
        }, 1200);
    });
}

// Bot keeper decide zone (covers a group of 3 zones)
function botKeeperDecide(r) {
    const acc = KEEPER_ACCURACY[Math.min(r, KEEPER_ACCURACY.length - 1)];
    if (Math.random() < acc) {
        // Will guess a nearby zone – returned as "sector" index 0-8
        return Math.floor(Math.random() * 9);
    }
    return Math.floor(Math.random() * 9);
}

// Animate ball flying to zone, keeper diving
function animateShot(shotZone, keeperZone, cb) {
    const target = ZONE_POS[shotZone];
    const goalNet = document.querySelector('.goal-net');
    const gRect   = goalNet.getBoundingClientRect();
    const fieldRect = document.querySelector('.field').getBoundingClientRect();

    // Move ball toward zone
    const bx = gRect.left - fieldRect.left + gRect.width  * (target.l / 100);
    const by = gRect.top  - fieldRect.top  + gRect.height * (1 - target.b / 100);

    ball.style.transition = 'all 0.4s cubic-bezier(.4,0,.2,1)';
    ball.style.left = bx + 'px';
    ball.style.bottom = 'auto';
    ball.style.top  = by + 'px';
    ball.classList.add('flying');

    // Keeper dives toward keeperZone
    const keeperTarget = ZONE_POS[keeperZone];
    keeper.style.left   = keeperTarget.l + '%';
    keeper.style.bottom = keeperTarget.b + '%';

    // Highlight zones
    document.querySelector(`.zone[data-zone="${shotZone}"]`).classList.add('target');

    setTimeout(() => {
        // Check saved: keeper zone same column+row proximity
        const saved = isZoneSaved(shotZone, keeperZone);
        const zoneEl = document.querySelector(`.zone[data-zone="${shotZone}"]`);
        zoneEl.classList.remove('target');

        if (saved) {
            zoneEl.classList.add('saved');
            showFlash('SAVED! 🧤', 'miss-flash');
        } else {
            zoneEl.classList.add('scored');
            showFlash('GOAL! ⚽', 'goal-flash');
        }
        cb(!saved);
    }, 500);
}

function isZoneSaved(shotZone, keeperZone) {
    // Same zone = saved. Adjacent zones have 50% chance
    if (shotZone === keeperZone) return true;
    const sameCol = (shotZone % 3) === (keeperZone % 3);
    const sameRow = Math.floor(shotZone / 3) === Math.floor(keeperZone / 3);
    if (sameCol || sameRow) return Math.random() < 0.4;
    return false;
}

// ── KEEPER MODE ─────────────────────────────────────────
// Map dive direction to keeper destination zones
const DIVE_ZONES = {
    left:  [0, 3, 6],
    top:   [0, 1, 2],
    right: [2, 5, 8],
};

function handleKeeperClick(zone) {
    if (busy) return;
    busy = true;
    setInputEnabled(false);

    // Player keeper dives to clicked zone
    const kTarget = ZONE_POS[zone];
    keeper.style.left   = kTarget.l + '%';
    keeper.style.bottom = kTarget.b + '%';

    const botZone = botShooterDecide();
    animateBotShot(botZone, zone, (isGoal) => {
        if (isGoal) { botScore++; botHistory.push('goal'); }
        else        { botHistory.push('miss'); }

        // Player shoots back
        setTimeout(() => {
            playerCounterShoot((pGoal) => {
                if (pGoal) { playerScore++; playerHistory.push('goal'); }
                else       { playerHistory.push('miss'); }
                round++;
                updateScoreboard();
                setTimeout(beginRound, 900);
            });
        }, 1200);
    });
}

function handleKeeperDive(dir) {
    if (busy) return;
    const zonePool = DIVE_ZONES[dir];
    const zone = zonePool[Math.floor(Math.random() * zonePool.length)];
    handleKeeperClick(zone);
}

function botShooterDecide() {
    const total = BOT_SHOT_WEIGHTS.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < BOT_SHOT_WEIGHTS.length; i++) {
        r -= BOT_SHOT_WEIGHTS[i];
        if (r <= 0) return i;
    }
    return 8;
}

function animateBotShot(botZone, keeperZone, cb) {
    const target  = ZONE_POS[botZone];
    const goalNet = document.querySelector('.goal-net');
    const gRect   = goalNet.getBoundingClientRect();
    const fieldRect = document.querySelector('.field').getBoundingClientRect();

    const bx = gRect.left - fieldRect.left + gRect.width  * (target.l / 100);
    const by = gRect.top  - fieldRect.top  + gRect.height * (1 - target.b / 100);

    ball.style.transition = 'all 0.4s cubic-bezier(.4,0,.2,1)';
    ball.style.left = bx + 'px';
    ball.style.top  = by + 'px';
    ball.style.bottom = 'auto';
    ball.classList.add('flying');

    document.querySelector(`.zone[data-zone="${botZone}"]`).classList.add('target');

    setTimeout(() => {
        const saved = isZoneSaved(botZone, keeperZone);
        const zoneEl = document.querySelector(`.zone[data-zone="${botZone}"]`);
        zoneEl.classList.remove('target');

        if (saved) {
            zoneEl.classList.add('saved');
            showFlash('GREAT SAVE! 🧤', 'save-flash');
        } else {
            zoneEl.classList.add('scored');
            showFlash('BOT SCORES! ⚽', 'miss-flash');
        }
        cb(!saved);
    }, 500);
}

// Player counter-shoots (auto, random zone for now after keeper round)
function playerCounterShoot(cb) {
    resetBallAndKeeper();
    clearZoneHighlights();

    // Random zone player shoots (auto in keeper mode, just for parity)
    const zone = Math.floor(Math.random() * 9);
    const keeperZone = botKeeperDecide(round);
    animateShot(zone, keeperZone, cb);
}

// Bot shoots (used in shooter mode for parity round)
function botShoot(cb) {
    resetBallAndKeeper();
    clearZoneHighlights();

    const botZone = botShooterDecide();
    const keeperZone = Math.floor(Math.random() * 9);
    animateBotShot(botZone, keeperZone, cb);
}

// ── HELPERS ─────────────────────────────────────────────
function resetBallAndKeeper() {
    ball.style.transition = 'none';
    ball.style.left   = '50%';
    ball.style.bottom = '38%';
    ball.style.top    = 'auto';
    ball.style.transform = 'translateX(-50%)';
    ball.classList.remove('flying');

    keeper.style.transition = 'none';
    keeper.style.left   = '50%';
    keeper.style.bottom = '0%';
    keeper.style.transform = 'translateX(-50%)';

    // Re-enable transitions after reset frame
    requestAnimationFrame(() => {
        ball.style.transition   = 'all 0.4s cubic-bezier(.4,0,.2,1)';
        keeper.style.transition = 'left 0.25s cubic-bezier(.34,1.56,.64,1), bottom 0.2s';
    });
}

function clearZoneHighlights() {
    zones.forEach(z => z.classList.remove('target', 'saved', 'scored'));
}

function showFlash(msg, cls) {
    resultFlash.textContent = msg;
    resultFlash.className   = 'result-flash ' + cls;
    setTimeout(() => resultFlash.classList.add('hidden'), 900);
}

// ── END GAME ────────────────────────────────────────────
function endGame() {
    let trophy, title;
    if (playerScore > botScore) {
        trophy = '🏆'; title = 'YOU WIN!';
    } else if (playerScore < botScore) {
        trophy = '😞'; title = 'BOT WINS!';
    } else {
        trophy = '🤝'; title = "IT'S A DRAW!";
    }
    resultTrophy.textContent = trophy;
    resultTitle.textContent  = title;
    resultSub.textContent    = `${playerScore} – ${botScore}`;
    setTimeout(() => showScreen('screenResult'), 600);
}

// ── NAV ─────────────────────────────────────────────────
function rematch()  { startGame(mode); }
function goMode()   { showScreen('screenMode'); }
function goLobby()  { window.location.href = '../../index.html'; }
