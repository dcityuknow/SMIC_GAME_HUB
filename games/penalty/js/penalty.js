'use strict';

// ── CONFIG ──────────────────────────────────────────────
const TOTAL_ROUNDS = 5;

// Keeper AI accuracy per round (xác suất đoán đúng cột của bot thủ môn)
const KEEPER_ACCURACY = [0.30, 0.35, 0.40, 0.42, 0.48];

// Bot shooter: trọng số zone (góc dưới ưu tiên)
const BOT_SHOT_WEIGHTS = [2,1,2, 1,0,1, 3,1,3];

// Zone 0-8 → vị trí trong .goal-net (left%, bottom%)
// Hàng trên: 0,1,2 | Hàng giữa: 3,4,5 | Hàng dưới: 6,7,8
const ZONE_POS = [
    { l:16, b:72 }, { l:50, b:72 }, { l:84, b:72 },
    { l:16, b:46 }, { l:50, b:46 }, { l:84, b:46 },
    { l:16, b:16 }, { l:50, b:16 }, { l:84, b:16 },
];

function zoneToDiveDir(zone) {
    const col = zone % 3;
    if (col === 0) return 'left';
    if (col === 2) return 'right';
    return 'center';
}

// ── STATE ───────────────────────────────────────────────
let mode          = 'shooter';
let round         = 0;
let playerScore   = 0;
let botScore      = 0;
let playerHistory = [];
let botHistory    = [];
let busy          = false;

// ── DOM REFS ────────────────────────────────────────────
const screenMode    = document.getElementById('screenMode');
const screenGame    = document.getElementById('screenGame');
const screenResult  = document.getElementById('screenResult');

const playerScoreEl = document.getElementById('playerScore');
const botScoreEl    = document.getElementById('botScore');
const playerDotsEl  = document.getElementById('playerDots');
const botDotsEl     = document.getElementById('botDots');
const sbRoundEl     = document.getElementById('sbRound');
const playerLabel   = document.getElementById('playerLabel');

const keeper        = document.getElementById('keeper');
const keeperStand   = document.getElementById('keeperStand');
const keeperLeft    = document.getElementById('keeperLeft');
const keeperRight   = document.getElementById('keeperRight');

const ball          = document.getElementById('ball');
const shooterSprite = document.getElementById('shooterSprite');
const zones         = document.querySelectorAll('.zone');
const actionHint    = document.getElementById('actionHint');
const resultFlash   = document.getElementById('resultFlash');

const resultTrophy  = document.getElementById('resultTrophy');
const resultTitle   = document.getElementById('resultTitle');
const resultSub     = document.getElementById('resultSub');

// ── KEEPER POSE ─────────────────────────────────────────
function setKeeperPose(dir) {
    keeper.classList.remove('dive-left', 'dive-right');
    [keeperStand, keeperLeft, keeperRight].forEach(img => img.classList.remove('active'));

    if (dir === 'left') {
        keeperLeft.classList.add('active');
        keeper.classList.add('dive-left');
    } else if (dir === 'right') {
        keeperRight.classList.add('active');
        keeper.classList.add('dive-right');
    } else {
        keeperStand.classList.add('active');
    }
}
setKeeperPose('stand');

// ── SCREENS ─────────────────────────────────────────────
function showScreen(id) {
    [screenMode, screenGame, screenResult].forEach(s =>
        s.classList.toggle('hidden', s.id !== id)
    );
}

// ── START GAME ──────────────────────────────────────────
function startGame(selectedMode) {
    mode          = selectedMode;
    round         = 0;
    playerScore   = 0;
    botScore      = 0;
    playerHistory = [];
    botHistory    = [];
    busy          = false;

    playerLabel.textContent = mode === 'shooter' ? 'YOU' : 'YOU';

    // Trong shooter mode: zones trên khung thành = chọn nơi sút
    // Trong keeper mode:  zones trên khung thành = chọn nơi nhảy
    if (mode === 'shooter') {
        actionHint.textContent = 'CLICK KHUNG THÀNH ĐỂ SÚT';
        zones.forEach(z => { z.onclick = () => shooterTurn(parseInt(z.dataset.zone)); });
    } else {
        actionHint.textContent = 'CLICK KHUNG THÀNH ĐỂ BẮT BÓNG';
        zones.forEach(z => { z.onclick = () => keeperTurn(parseInt(z.dataset.zone)); });
    }

    updateScoreboard();
    resetBallAndKeeper();
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

function setInputEnabled(on) {
    zones.forEach(z => z.style.pointerEvents = on ? 'auto' : 'none');
}

// ── ROUND ───────────────────────────────────────────────
function beginRound() {
    if (round >= TOTAL_ROUNDS) { endGame(); return; }
    busy = false;
    resetBallAndKeeper();
    clearZoneHighlights();
    updateScoreboard();
    setInputEnabled(true);
    resultFlash.classList.add('hidden');

    if (mode === 'shooter') {
        actionHint.textContent = 'CLICK VÀO KHUNG THÀNH ĐỂ SÚT';
    } else {
        actionHint.textContent = 'CLICK VÀO KHUNG THÀNH ĐỂ BẮT BÓNG';
    }
}

// ════════════════════════════════════════════════════════
// SHOOTER MODE — user click zone → sút; bot làm thủ môn
// ════════════════════════════════════════════════════════
function shooterTurn(shotZone) {
    if (busy) return;
    busy = true;
    setInputEnabled(false);
    actionHint.textContent = '';

    const keeperZone = botDecideKeeper(round);
    animateShotToGoal(shotZone, keeperZone, (isGoal) => {
        if (isGoal) { playerScore++; playerHistory.push('goal'); }
        else        { playerHistory.push('miss'); }
        round++;
        updateScoreboard();
        setTimeout(beginRound, 1100);
    });
}

// Bot thủ môn đoán zone
function botDecideKeeper(r) {
    const acc = KEEPER_ACCURACY[Math.min(r, KEEPER_ACCURACY.length - 1)];
    // Với xác suất acc, bot đoán đúng cột (col) của bóng
    // Nếu không, random hoàn toàn
    return Math.floor(Math.random() * 9);
}

// Animate: bóng bay + keeper nhảy
function animateShotToGoal(shotZone, keeperZone, cb) {
    const target    = ZONE_POS[shotZone];
    const goalNet   = document.querySelector('.goal-net');
    const gRect     = goalNet.getBoundingClientRect();
    const fieldRect = document.getElementById('field').getBoundingClientRect();

    const bx = gRect.left - fieldRect.left + gRect.width  * (target.l / 100);
    const by = gRect.top  - fieldRect.top  + gRect.height * (1 - target.b / 100);

    ball.style.transition = 'all 0.42s cubic-bezier(.25,.46,.45,.94)';
    ball.style.left   = bx + 'px';
    ball.style.top    = by + 'px';
    ball.style.bottom = 'auto';
    ball.classList.add('flying');

    // Keeper nhảy
    const kTarget  = ZONE_POS[keeperZone];
    keeper.style.left   = kTarget.l + '%';
    keeper.style.bottom = kTarget.b + '%';
    setKeeperPose(zoneToDiveDir(keeperZone));

    document.querySelector(`.zone[data-zone="${shotZone}"]`).classList.add('target');

    setTimeout(() => {
        const saved = isZoneSaved(shotZone, keeperZone);
        const zEl = document.querySelector(`.zone[data-zone="${shotZone}"]`);
        zEl.classList.remove('target');
        if (saved) {
            zEl.classList.add('saved');
            showFlash('SAVED! 🧤', 'miss-flash');
        } else {
            zEl.classList.add('scored');
            showFlash('GOAL! ⚽', 'goal-flash');
        }
        cb(!saved);
    }, 520);
}

// ════════════════════════════════════════════════════════
// KEEPER MODE — bot sút; user click zone → nhảy chặn
// ════════════════════════════════════════════════════════
function keeperTurn(keeperZone) {
    if (busy) return;
    busy = true;
    setInputEnabled(false);
    actionHint.textContent = '';

    // User di chuyển keeper đến zone chọn
    const kTarget = ZONE_POS[keeperZone];
    keeper.style.left   = kTarget.l + '%';
    keeper.style.bottom = kTarget.b + '%';
    setKeeperPose(zoneToDiveDir(keeperZone));

    // Bot quyết định sút zone nào
    const botShotZone = botDecideShot();

    animateBotShotToGoal(botShotZone, keeperZone, (botScored) => {
        if (botScored) { botScore++; botHistory.push('goal'); }
        else           { botHistory.push('miss'); }

        // Player được ghi điểm tự động ngẫu nhiên (parity) hoặc thêm logic AI
        // Ở keeper mode: player KHÔNG bắn, chỉ bắt bóng
        // Score của player = số lần bắt thành công
        if (!botScored) { playerScore++; playerHistory.push('goal'); }
        else            { playerHistory.push('miss'); }

        round++;
        updateScoreboard();
        setTimeout(beginRound, 1100);
    });
}

function botDecideShot() {
    const total = BOT_SHOT_WEIGHTS.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < BOT_SHOT_WEIGHTS.length; i++) {
        r -= BOT_SHOT_WEIGHTS[i];
        if (r <= 0) return i;
    }
    return 8;
}

function animateBotShotToGoal(botZone, keeperZone, cb) {
    const target    = ZONE_POS[botZone];
    const goalNet   = document.querySelector('.goal-net');
    const gRect     = goalNet.getBoundingClientRect();
    const fieldRect = document.getElementById('field').getBoundingClientRect();

    const bx = gRect.left - fieldRect.left + gRect.width  * (target.l / 100);
    const by = gRect.top  - fieldRect.top  + gRect.height * (1 - target.b / 100);

    ball.style.transition = 'all 0.42s cubic-bezier(.25,.46,.45,.94)';
    ball.style.left   = bx + 'px';
    ball.style.top    = by + 'px';
    ball.style.bottom = 'auto';
    ball.classList.add('flying');

    document.querySelector(`.zone[data-zone="${botZone}"]`).classList.add('target');

    setTimeout(() => {
        const saved = isZoneSaved(botZone, keeperZone);
        const zEl = document.querySelector(`.zone[data-zone="${botZone}"]`);
        zEl.classList.remove('target');
        if (saved) {
            zEl.classList.add('saved');
            showFlash('GREAT SAVE! 🧤', 'save-flash');
        } else {
            zEl.classList.add('scored');
            showFlash('BOT SCORES! ⚽', 'miss-flash');
        }
        cb(!saved);
    }, 520);
}

// ── HELPERS ─────────────────────────────────────────────
function isZoneSaved(shotZone, keeperZone) {
    if (shotZone === keeperZone) return true;
    const sameCol = (shotZone % 3) === (keeperZone % 3);
    const sameRow = Math.floor(shotZone / 3) === Math.floor(keeperZone / 3);
    if (sameCol || sameRow) return Math.random() < 0.38;
    return false;
}

function resetBallAndKeeper() {
    ball.style.transition = 'none';
    ball.style.left       = '50%';
    ball.style.bottom     = '36%';
    ball.style.top        = 'auto';
    ball.style.transform  = 'translateX(-50%)';
    ball.classList.remove('flying');

    keeper.style.transition = 'none';
    keeper.style.left       = '50%';
    keeper.style.bottom     = '0%';
    keeper.style.transform  = 'translateX(-50%)';
    setKeeperPose('stand');

    requestAnimationFrame(() => {
        ball.style.transition   = 'all 0.42s cubic-bezier(.25,.46,.45,.94)';
        keeper.style.transition = 'left 0.22s cubic-bezier(.34,1.56,.64,1), bottom 0.18s ease-out';
    });
}

function clearZoneHighlights() {
    zones.forEach(z => z.classList.remove('target', 'saved', 'scored'));
}

function showFlash(msg, cls) {
    resultFlash.textContent = msg;
    resultFlash.className   = 'result-flash ' + cls;
    setTimeout(() => resultFlash.classList.add('hidden'), 950);
}

// ── END GAME ────────────────────────────────────────────
function endGame() {
    let trophy, title;
    if      (playerScore > botScore) { trophy = '🏆'; title = 'YOU WIN!'; }
    else if (playerScore < botScore) { trophy = '😞'; title = 'BOT WINS!'; }
    else                             { trophy = '🤝'; title = "IT'S A DRAW!"; }
    resultTrophy.textContent = trophy;
    resultTitle.textContent  = title;
    resultSub.textContent    = `${playerScore} – ${botScore}`;
    setTimeout(() => showScreen('screenResult'), 700);
}

// ── NAV ─────────────────────────────────────────────────
function rematch()  { startGame(mode); }
function goMode()   { showScreen('screenMode'); }
function goLobby()  { window.location.href = '../../index.html'; }
