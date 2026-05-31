'use strict';

// ── INJECT goalkeeper2 img if not in HTML ───────────────
(function() {
    if (!document.getElementById('keeperStand2')) {
        const keeperEl = document.getElementById('keeper');
        if (keeperEl) {
            const img = document.createElement('img');
            img.className = 'keeper-img';
            img.id = 'keeperStand2';
            img.src = '../../assets/images/penalty/goalkeeper2.png';
            img.alt = 'GK2';
            keeperEl.insertBefore(img, keeperEl.querySelector('#keeperUp'));
        }
    }
})();

// ── CONFIG ──────────────────────────────────────────────
const TOTAL_ROUNDS = 5;
const KEEPER_ACCURACY  = [0.30, 0.35, 0.40, 0.42, 0.48];
const BOT_SHOT_WEIGHTS = [2,1,2, 1,0,1, 3,1,3];

const ZONE_POS = [
    { l:17, b:30 }, { l:50, b:42 }, { l:83, b:35 },
    { l:6,  b:18 }, { l:50, b:10 }, { l:84, b:16 },
    { l:16, b:-10 },{ l:50, b:1  }, { l:84, b:-10 },
];

function zoneToDiveDir(zone) {
    const dirs = ['left-up','up','right-up','left','stand','right','left-down','down','right-down'];
    return dirs[zone] ?? 'stand';
}

// ── STATE ───────────────────────────────────────────────
let mode          = 'shooter';
let round         = 0;
let playerScore   = 0;
let botScore      = 0;
let playerHistory = [];
let botHistory    = [];
let busy          = false;

// ── POWER BAR STATE ─────────────────────────────────────
let powerBarActive    = false;
let powerBarValue     = 0;
let powerBarDirection = 1;
let powerBarRAF       = null;
let shootTriggered    = false;

// Multi-key arrow state: track which keys are held
const heldKeys = new Set(); // 'up','down','left','right'

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

const keeper         = document.getElementById('keeper');
const keeperStand    = document.getElementById('keeperStand');
const keeperStand2   = document.getElementById('keeperStand2');
const keeperUp       = document.getElementById('keeperUp');
const keeperDown     = document.getElementById('keeperDown');
const keeperLeft     = document.getElementById('keeperLeft');
const keeperRight    = document.getElementById('keeperRight');
const keeperLeftUp   = document.getElementById('keeperLeftUp');
const keeperLeftDown = document.getElementById('keeperLeftDown');
const keeperRightUp  = document.getElementById('keeperRightUp');
const keeperRightDown= document.getElementById('keeperRightDown');

const ALL_KEEPER_IMGS = [
    keeperStand, keeperStand2, keeperUp, keeperDown, keeperLeft, keeperRight,
    keeperLeftUp, keeperLeftDown, keeperRightUp, keeperRightDown
];

// ── KEEPER IDLE ANIMATION ───────────────────────────────
let keeperIdleInterval = null;
let keeperIdleFrame    = 0;   // 0 = goalkeeper.png, 1 = goalkeeper2.png

function startKeeperIdle() {
    stopKeeperIdle();
    keeperIdleFrame = 0;
    keeperStand.classList.add('active');
    keeperStand2 && keeperStand2.classList.remove('active');

    keeperIdleInterval = setInterval(() => {
        keeperIdleFrame = 1 - keeperIdleFrame;
        if (keeperIdleFrame === 0) {
            keeperStand.classList.add('active');
            keeperStand2 && keeperStand2.classList.remove('active');
        } else {
            keeperStand2 && keeperStand2.classList.add('active');
            keeperStand.classList.remove('active');
        }
    }, 600); // swap every 600ms
}

function stopKeeperIdle() {
    if (keeperIdleInterval) { clearInterval(keeperIdleInterval); keeperIdleInterval = null; }
}

const ball          = document.getElementById('ball');
const shooterSprite = document.getElementById('shooterSprite');
const zones         = document.querySelectorAll('.zone');
const actionHint    = document.getElementById('actionHint');
const resultFlash   = document.getElementById('resultFlash');
const resultTrophy  = document.getElementById('resultTrophy');
const resultTitle   = document.getElementById('resultTitle');
const resultSub     = document.getElementById('resultSub');

const powerBarWrap  = document.getElementById('powerBarWrap');
const powerBarFill  = document.getElementById('powerBarFill');
const powerBarLabel = document.getElementById('powerBarLabel');
const arrowDisplay  = document.getElementById('arrowDisplay');
const arrowBtns     = document.querySelectorAll('.arrow-btn');

// ── KEEPER POSE ─────────────────────────────────────────
const ALL_POSE_CLASSES = [
    'pose-up','pose-down','pose-left','pose-right',
    'pose-left-up','pose-left-down','pose-right-up','pose-right-down'
];

function setKeeperPose(dir) {
    ALL_POSE_CLASSES.forEach(c => keeper.classList.remove(c));
    ALL_KEEPER_IMGS.forEach(img => img && img.classList.remove('active'));
    stopKeeperIdle();

    const map = {
        'stand':      { img: keeperStand,     cls: null               },
        'up':         { img: keeperUp,         cls: 'pose-up'         },
        'down':       { img: keeperDown,       cls: 'pose-down'       },
        'left':       { img: keeperLeft,       cls: 'pose-left'       },
        'right':      { img: keeperRight,      cls: 'pose-right'      },
        'left-up':    { img: keeperLeftUp,     cls: 'pose-left-up'    },
        'left-down':  { img: keeperLeftDown,   cls: 'pose-left-down'  },
        'right-up':   { img: keeperRightUp,    cls: 'pose-right-up'   },
        'right-down': { img: keeperRightDown,  cls: 'pose-right-down' },
    };
    const pose = map[dir] || map['stand'];
    if (pose.cls) keeper.classList.add(pose.cls);

    if (dir === 'stand') {
        startKeeperIdle(); // luân phiên 2 ảnh + sway CSS
    } else {
        if (pose.img) pose.img.classList.add('active');
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
    playerLabel.textContent = 'YOU';

    if (mode === 'keeper') {
        zones.forEach(z => { z.onclick = () => keeperTurn(parseInt(z.dataset.zone)); });
    } else {
        zones.forEach(z => { z.onclick = null; });
    }

    if (mode === 'shooter') {
        powerBarWrap.classList.remove('hidden');
        setupKeyControls();
        actionHint.textContent = 'GIỮ [D] TÍCH LỰC + MŨI TÊN CHỌN HƯỚNG';
    } else {
        powerBarWrap.classList.add('hidden');
        removeKeyControls();
        actionHint.textContent = 'CLICK VÀO KHUNG THÀNH ĐỂ BẮT BÓNG';
    }

    updateScoreboard();
    resetBallAndKeeper();
    showScreen('screenGame');
    setTimeout(beginRound, 400);
}

// ── KEY CONTROLS ─────────────────────────────────────────
function setupKeyControls() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup',   onKeyUp);
    arrowBtns.forEach(btn => {
        btn.addEventListener('pointerdown', onArrowBtnDown);
        btn.addEventListener('pointerup',   onArrowBtnUp);
        btn.addEventListener('pointerleave',onArrowBtnUp);
    });
    const shootBtn = document.getElementById('shootBtn');
    if (shootBtn) {
        shootBtn.addEventListener('pointerdown', onShootBtnDown);
        shootBtn.addEventListener('pointerup',   onShootBtnUp);
        shootBtn.addEventListener('pointerleave',onShootBtnUp);
    }
}
function removeKeyControls() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup',   onKeyUp);
    heldKeys.clear();
}

// ── DIRECTION HELPERS ────────────────────────────────────
// Combine held keys → composite direction string
function getCompositeDir() {
    const u = heldKeys.has('up'),   d = heldKeys.has('down');
    const l = heldKeys.has('left'), r = heldKeys.has('right');
    if (u && l) return 'up-left';
    if (u && r) return 'up-right';
    if (d && l) return 'down-left';
    if (d && r) return 'down-right';
    if (u) return 'up';
    if (d) return 'down';
    if (l) return 'left';
    if (r) return 'right';
    return null;
}

// Arrow display icon for composite directions
const DIR_ICONS = {
    'up':'↑', 'down':'↓', 'left':'←', 'right':'→',
    'up-left':'↖', 'up-right':'↗', 'down-left':'↙', 'down-right':'↘',
};

function onKeyDown(e) {
    if (busy || mode !== 'shooter') return;
    const arrowMap = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down' };
    if (arrowMap[e.code]) {
        e.preventDefault();
        heldKeys.add(arrowMap[e.code]);
        updateArrowDisplay();
    }
    if (e.code === 'KeyD' && !powerBarActive && !shootTriggered) {
        e.preventDefault();
        startPowerBar();
    }
}

function onKeyUp(e) {
    if (mode !== 'shooter') return;
    const arrowMap = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down' };
    if (arrowMap[e.code]) {
        heldKeys.delete(arrowMap[e.code]);
        updateArrowDisplay();
    }
    if (e.code === 'KeyD' && powerBarActive && !shootTriggered) {
        e.preventDefault();
        releasePowerBar();
    }
}

// Mobile touch arrow buttons — support multi-touch for diagonal
function onArrowBtnDown(e) {
    if (busy || mode !== 'shooter') return;
    e.preventDefault();
    const dir = e.currentTarget.dataset.dir;
    // Handle composite directions (diagonal buttons) directly
    if (dir.includes('-')) {
        // diagonal button: split and add both component keys
        const parts = dir.split('-'); // e.g. ['up','left'] or ['down','right']
        parts.forEach(p => heldKeys.add(p));
    } else {
        heldKeys.add(dir);
    }
    updateArrowDisplay();
}
function onArrowBtnUp(e) {
    e.preventDefault();
    const dir = e.currentTarget.dataset.dir;
    if (dir.includes('-')) {
        const parts = dir.split('-');
        parts.forEach(p => heldKeys.delete(p));
    } else {
        heldKeys.delete(dir);
    }
    updateArrowDisplay();
}
function onShootBtnDown(e) {
    if (busy || mode !== 'shooter' || shootTriggered) return;
    e.preventDefault();
    startPowerBar();
}
function onShootBtnUp(e) {
    if (mode !== 'shooter' || !powerBarActive || shootTriggered) return;
    e.preventDefault();
    releasePowerBar();
}

// ── POWER BAR LOGIC ──────────────────────────────────────
const POWER_SPEED = 0.18;

function startPowerBar() {
    if (powerBarActive || busy) return;
    powerBarActive    = true;
    powerBarValue     = 0;
    powerBarDirection = 1;
    shootTriggered    = false;
    powerBarWrap.classList.add('active');
    actionHint.textContent = 'THẢ [D] ĐỂ SÚT!';
    let lastTime = performance.now();

    function tick(now) {
        const dt = now - lastTime;
        lastTime = now;
        powerBarValue += POWER_SPEED * dt * powerBarDirection;
        if (powerBarValue >= 100) { powerBarValue = 100; powerBarDirection = -1; }
        if (powerBarValue <= 0 && powerBarDirection === -1) { powerBarValue = 0; powerBarDirection = 1; }
        updatePowerBarUI();
        powerBarRAF = requestAnimationFrame(tick);
    }
    powerBarRAF = requestAnimationFrame(tick);
}

function releasePowerBar() {
    if (!powerBarActive) return;
    cancelAnimationFrame(powerBarRAF);
    powerBarActive = false;
    shootTriggered = true;

    const finalPower = powerBarValue;
    const finalDir   = getCompositeDir();

    powerBarWrap.classList.remove('active');
    heldKeys.clear();
    resetArrowDisplay();
    powerBarValue = 0;
    updatePowerBarUI();

    const zone = calcZoneFromPowerAndDir(finalPower, finalDir);
    shooterTurn(zone, finalPower);
}

function updatePowerBarUI() {
    const pct = powerBarValue;
    powerBarFill.style.width = pct + '%';
    let color;
    if      (pct < 50) color = `hsl(${120 - pct * 0.4}, 90%, 52%)`;
    else if (pct < 75) color = `hsl(${100 - (pct-50)*2.8}, 90%, 52%)`;
    else               color = `hsl(${30  - (pct-75)*1.2}, 92%, 52%)`;
    powerBarFill.style.background = color;
    powerBarFill.style.boxShadow  = `0 0 12px ${color}99, 0 0 4px ${color}`;
    if      (pct < 40) powerBarLabel.textContent = 'NHẸ';
    else if (pct < 65) powerBarLabel.textContent = 'VỪA ⚡';
    else if (pct < 85) powerBarLabel.textContent = 'MẠNH 🔥';
    else               powerBarLabel.textContent  = 'NGUY HIỂM ⚠️';
}

function updateArrowDisplay() {
    const dir = getCompositeDir();
    // highlight all held arrow buttons
    arrowBtns.forEach(btn => btn.classList.toggle('active', heldKeys.has(btn.dataset.dir)));
    arrowDisplay.textContent = dir ? (DIR_ICONS[dir] ?? '•') : '•';
}

function resetArrowDisplay() {
    arrowBtns.forEach(btn => btn.classList.remove('active'));
    arrowDisplay.textContent = '•';
}

// ── ZONE CALCULATION ─────────────────────────────────────
// Zones:  0(↖) 1(↑) 2(↗)
//         3(←) 4(·) 5(→)
//         6(↙) 7(↓) 8(↘)
function calcZoneFromPowerAndDir(power, dir) {
    if (power > 85) return -1; // OUT

    // Map composite direction → zone
    const dirZoneMap = {
        'up-left':   0, 'up':    1, 'up-right':   2,
        'left':      3,             'right':       5,
        'down-left': 6, 'down':  7, 'down-right':  8,
    };

    if (dir && dirZoneMap[dir] !== undefined) {
        // Straight down with low power is usually low-center, allow it
        return dirZoneMap[dir];
    }

    // No direction → straight shot; height determined by power
    if (power >= 50) return 1; // center-top
    if (power >= 30) return 4; // center-mid
    return 7;                  // center-low
}

// ── SCOREBOARD ──────────────────────────────────────────
function updateScoreboard() {
    playerScoreEl.textContent = playerScore;
    botScoreEl.textContent    = botScore;
    sbRoundEl.textContent     = round < TOTAL_ROUNDS
        ? `ROUND ${round + 1}/${TOTAL_ROUNDS}` : 'FINAL';
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
    shootTriggered = false;
    powerBarActive = false;
    powerBarValue  = 0;
    heldKeys.clear();
    cancelAnimationFrame(powerBarRAF);
    powerBarWrap.classList.remove('active');
    updatePowerBarUI();
    resetArrowDisplay();
    resetBallAndKeeper();
    clearZoneHighlights();
    updateScoreboard();
    setInputEnabled(true);
    resultFlash.classList.add('hidden');

    if (mode === 'shooter') {
        actionHint.textContent = 'GIỮ [D] TÍCH LỰC + MŨI TÊN CHỌN HƯỚNG';
    } else {
        actionHint.textContent = 'CLICK VÀO KHUNG THÀNH ĐỂ BẮT BÓNG';
    }
}

// ════════════════════════════════════════════════════════
// SHOOTER MODE
// ════════════════════════════════════════════════════════
function shooterTurn(shotZone, power) {
    if (busy) return;
    busy = true;
    setInputEnabled(false);
    actionHint.textContent = '';

    if (shotZone === -1) {
        animateShotOut(power, () => {
            playerHistory.push('miss');
            round++;
            updateScoreboard();
            setTimeout(beginRound, 1100);
        });
        return;
    }

    const keeperZone = botDecideKeeper(round);
    animateShotToGoal(shotZone, keeperZone, power, (isGoal) => {
        if (isGoal) { playerScore++; playerHistory.push('goal'); }
        else        { playerHistory.push('miss'); }
        round++;
        updateScoreboard();
        setTimeout(beginRound, 1100);
    });
}

function botDecideKeeper(r) {
    return Math.floor(Math.random() * 9);
}

// ── Shared shooter run-up animation + callback ───────────
function runShooterAnim(onKick) {
    shooterSprite.classList.remove('kicking');
    shooterSprite.classList.add('runup');
    setTimeout(() => {
        shooterSprite.classList.remove('runup');
        shooterSprite.classList.add('kicking');
        onKick();
    }, 380);
}

function animateShotOut(power, cb) {
    const fieldRect = document.getElementById('field').getBoundingClientRect();
    const goalNet   = document.querySelector('.goal-net');
    const gRect     = goalNet.getBoundingClientRect();
    const outX = gRect.left - fieldRect.left + gRect.width * (0.3 + Math.random() * 0.4);
    const outY = gRect.top  - fieldRect.top  - 80 - Math.random() * 60;

    runShooterAnim(() => {
        const sx = fieldRect.width  * 0.5;
        const sy = fieldRect.height - fieldRect.height * 0.16;
        const startTime = performance.now();
        const duration  = 420;
        ball.style.transition = 'none';
        ball.classList.add('flying');

        function animFrame(now) {
            const t  = Math.min((now - startTime) / duration, 1);
            const et = easeInOutQuart(t);
            const cx = sx + (outX - sx) * et;
            const cy = sy + (outY - sy) * et - 40 * Math.sin(Math.PI * t);
            ball.style.left   = cx + 'px';
            ball.style.top    = cy + 'px';
            ball.style.bottom = 'auto';
            ball.style.transform = `translateX(-50%) rotate(${t*720}deg)`;
            if (t < 1) { requestAnimationFrame(animFrame); }
            else { showFlash('OUT! ❌', 'miss-flash'); cb(); }
        }
        requestAnimationFrame(animFrame);
    });
}

function animateShotToGoal(shotZone, keeperZone, power, cb) {
    const target    = ZONE_POS[shotZone];
    const goalNet   = document.querySelector('.goal-net');
    const gRect     = goalNet.getBoundingClientRect();
    const fieldRect = document.getElementById('field').getBoundingClientRect();

    const bx = gRect.left - fieldRect.left + gRect.width  * (target.l / 100);
    const by = gRect.top  - fieldRect.top  + gRect.height * (1 - target.b / 100);

    const speedFactor = 0.6 + (power / 100) * 0.8;
    const duration    = Math.round(480 / speedFactor);

    runShooterAnim(() => {
        keeper.classList.add('diving');
        keeper.style.left   = ZONE_POS[keeperZone].l + '%';
        keeper.style.bottom = ZONE_POS[keeperZone].b + '%';
        setKeeperPose(zoneToDiveDir(keeperZone));

        document.querySelector(`.zone[data-zone="${shotZone}"]`).classList.add('target');

        const sx = fieldRect.width  * 0.5;
        const sy = fieldRect.height - fieldRect.height * 0.16;
        const arcHeight = Math.max(40, (fieldRect.top + fieldRect.height - by) * 0.35);

        ball.style.transition = 'none';
        const startTime = performance.now();

        function animFrame(now) {
            const t  = Math.min((now - startTime) / duration, 1);
            const et = easeInOutQuart(t);
            const cx = sx + (bx - sx) * et;
            const arcT = 1 - Math.pow(2*t-1, 2);
            const cy = sy + (by - sy) * et - arcHeight * arcT;
            ball.style.left   = cx + 'px';
            ball.style.top    = cy + 'px';
            ball.style.bottom = 'auto';
            ball.classList.add('flying');
            ball.style.transform = `translateX(-50%) rotate(${t*360*(1.5+speedFactor*0.5)}deg)`;

            if (t < 1) {
                requestAnimationFrame(animFrame);
            } else {
                setTimeout(() => {
                    const saved = isZoneSaved(shotZone, keeperZone);
                    const zEl = document.querySelector(`.zone[data-zone="${shotZone}"]`);
                    zEl.classList.remove('target');
                    if (saved) { zEl.classList.add('saved');  showFlash('SAVED! 🧤',  'miss-flash'); }
                    else       { zEl.classList.add('scored'); showFlash('GOAL! ⚽',   'goal-flash'); }
                    cb(!saved);
                }, 60);
            }
        }
        requestAnimationFrame(animFrame);
    });
}

function easeInOutQuart(t) {
    return t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t+2, 4)/2;
}

// ════════════════════════════════════════════════════════
// KEEPER MODE — bot shoot WITH shooter run-up animation
// ════════════════════════════════════════════════════════
function keeperTurn(keeperZone) {
    if (busy) return;
    busy = true;
    setInputEnabled(false);
    actionHint.textContent = '';

    // Keeper stays standing — will dive only after the shooter actually kicks
    const botShotZone = botDecideShot();
    animateBotShotToGoal(botShotZone, keeperZone, (botScored) => {
        if (botScored) { botScore++; botHistory.push('goal'); }
        else           { botHistory.push('miss'); }
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

// Keeper mode: bot shooter also gets the run-up animation
function animateBotShotToGoal(botZone, keeperZone, cb) {
    const target    = ZONE_POS[botZone];
    const goalNet   = document.querySelector('.goal-net');
    const gRect     = goalNet.getBoundingClientRect();
    const fieldRect = document.getElementById('field').getBoundingClientRect();

    const bx = gRect.left - fieldRect.left + gRect.width  * (target.l / 100);
    const by = gRect.top  - fieldRect.top  + gRect.height * (1 - target.b / 100);

    // Bot run-up animation before ball launches
    runShooterAnim(() => {
        // Keeper dives exactly when the shooter's foot hits the ball
        const kTarget = ZONE_POS[keeperZone];
        keeper.style.left   = kTarget.l + '%';
        keeper.style.bottom = kTarget.b + '%';
        keeper.classList.add('diving');
        setKeeperPose(zoneToDiveDir(keeperZone));
        document.querySelector(`.zone[data-zone="${botZone}"]`).classList.add('target');

        const arcHeight = Math.max(60, (fieldRect.top + fieldRect.height - by) * 0.35);
        const sx = fieldRect.width * 0.5;
        const sy = fieldRect.height - fieldRect.height * 0.16;
        const startTime = performance.now();
        const duration  = 480;

        ball.style.transition = 'none';
        ball.classList.add('flying');

        function animFrame(now) {
            const t  = Math.min((now - startTime) / duration, 1);
            const et = easeInOutQuart(t);
            const cx = sx + (bx - sx) * et;
            const arcT = 1 - Math.pow(2*t-1, 2);
            const cy = sy + (by - sy) * et - arcHeight * arcT;
            ball.style.left   = cx + 'px';
            ball.style.top    = cy + 'px';
            ball.style.bottom = 'auto';
            ball.style.transform = `translateX(-50%) rotate(${t*540}deg)`;

            if (t < 1) {
                requestAnimationFrame(animFrame);
            } else {
                setTimeout(() => {
                    const saved = isZoneSaved(botZone, keeperZone);
                    const zEl = document.querySelector(`.zone[data-zone="${botZone}"]`);
                    zEl.classList.remove('target');
                    if (saved) { zEl.classList.add('saved');  showFlash('GREAT SAVE! 🧤', 'save-flash'); }
                    else       { zEl.classList.add('scored'); showFlash('BOT SCORES! ⚽', 'miss-flash'); }
                    cb(!saved);
                }, 60);
            }
        }
        requestAnimationFrame(animFrame);
    });
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
    ball.style.bottom     = '16%';
    ball.style.top        = 'auto';
    ball.style.transform  = 'translateX(-50%)';
    ball.classList.remove('flying');

    keeper.classList.remove('diving');
    keeper.style.transition = 'none';
    keeper.style.left       = '50%';
    keeper.style.bottom     = '0%';
    keeper.style.transform  = 'translateX(-50%)';
    setKeeperPose('stand');

    shooterSprite.classList.remove('runup','kicking');

    requestAnimationFrame(() => {
        ball.style.transition   = 'all 0.42s cubic-bezier(.25,.46,.45,.94)';
        keeper.style.transition = 'left 0.22s cubic-bezier(.34,1.56,.64,1), bottom 0.18s ease-out';
    });
}

function clearZoneHighlights() {
    zones.forEach(z => z.classList.remove('target','saved','scored'));
}

function showFlash(msg, cls) {
    resultFlash.textContent = msg;
    resultFlash.className   = 'result-flash ' + cls;
    setTimeout(() => resultFlash.classList.add('hidden'), 950);
}

// ── END GAME ────────────────────────────────────────────
function endGame() {
    removeKeyControls();
    let trophy, title;
    if      (playerScore > botScore) { trophy = '🏆'; title = 'YOU WIN!'; }
    else if (playerScore < botScore) { trophy = '😞'; title = 'BOT WINS!'; }
    else                             { trophy = '🤝'; title = "IT'S A DRAW!"; }
    resultTrophy.textContent = trophy;
    resultTitle.textContent  = title;
    resultSub.textContent    = `${playerScore} – ${botScore}`;

    // Inject background layers if not already present
    const screenResult = document.getElementById('screenResult');
    if (!screenResult.querySelector('.result-bg')) {
        const bg = document.createElement('div');
        bg.className = 'result-bg';
        // Path relative to HTML file location
        bg.style.backgroundImage = "url('../../assets/images/penalty/ketqua.png')";
        const vignette = document.createElement('div');
        vignette.className = 'result-vignette';
        screenResult.insertBefore(vignette, screenResult.firstChild);
        screenResult.insertBefore(bg, screenResult.firstChild);
    }

    setTimeout(() => showScreen('screenResult'), 700);
}

// ── NAV ─────────────────────────────────────────────────
function rematch()  { startGame(mode); }
function goMode()   { removeKeyControls(); showScreen('screenMode'); }
function goLobby()  { window.location.href = '../../index.html'; }
