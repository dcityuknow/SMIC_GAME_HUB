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

const BALL_ZONE_POS = [
    { l:17, b:55 }, { l:50, b:55 }, { l:83, b:55 },
    { l:10, b:18 }, { l:50, b:10 }, { l:100, b:16 },
    { l:16, b:10 },{ l:50, b:1  }, { l:84, b:10 },
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

const heldKeys = new Set();

// ── DOM REFS ────────────────────────────────────────────
const screenMode     = document.getElementById('screenMode');
const screenGame     = document.getElementById('screenGame');
const screenResult   = document.getElementById('screenResult');
const screenTraining = document.getElementById('screenTraining');

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
let keeperIdleFrame    = 0;

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
    }, 600);
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
        startKeeperIdle();
    } else {
        if (pose.img) pose.img.classList.add('active');
    }
}
setKeeperPose('stand');

// ── SCREENS ─────────────────────────────────────────────
function showScreen(id) {
    [screenMode, screenGame, screenResult, screenTraining].forEach(s =>
        s.classList.toggle('hidden', s.id !== id)
    );
}

// ── START GAME ──────────────────────────────────────────
function startGame(selectedMode) {
    mode = selectedMode;

    // ── Training mode ──
    if (mode === 'training') {
        round = 0; playerScore = 0; botScore = 0;
        playerHistory = []; botHistory = [];
        busy = false;
        removeKeyControls();
        showScreen('screenTraining');
        initTraining();
        return;
    }

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

function onArrowBtnDown(e) {
    if (busy || mode !== 'shooter') return;
    e.preventDefault();
    const dir = e.currentTarget.dataset.dir;
    if (dir.includes('-')) {
        const parts = dir.split('-');
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
    arrowBtns.forEach(btn => btn.classList.toggle('active', heldKeys.has(btn.dataset.dir)));
    arrowDisplay.textContent = dir ? (DIR_ICONS[dir] ?? '•') : '•';
}

function resetArrowDisplay() {
    arrowBtns.forEach(btn => btn.classList.remove('active'));
    arrowDisplay.textContent = '•';
}

function calcZoneFromPowerAndDir(power, dir) {
    if (power > 85) return -1;
    const dirZoneMap = {
        'up-left':   0, 'up':    1, 'up-right':   2,
        'left':      3,             'right':       5,
        'down-left': 6, 'down':  7, 'down-right':  8,
    };
    if (dir && dirZoneMap[dir] !== undefined) return dirZoneMap[dir];
    if (power >= 50) return 1;
    if (power >= 30) return 4;
    return 7;
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
            setTimeout(beginRound, 900);
        });
        return;
    }
    const keeperZone = botDecideKeeper(round);
    animateShotToGoal(shotZone, keeperZone, power, (isGoal) => {
        if (isGoal) { playerScore++; playerHistory.push('goal'); }
        else        { playerHistory.push('miss'); }
        round++;
        updateScoreboard();
        setTimeout(beginRound, 900);
    });
}

function botDecideKeeper(r) {
    return Math.floor(Math.random() * 9);
}

function runShooterAnim(onKick) {
    const img = shooterSprite.querySelector('img');
    shooterSprite.classList.remove('kicking', 'runup', 'impact');
    if (img) img.setAttribute('src', img.getAttribute('src').replace(/shooter(-\d)?\.png/, 'shooter.png'));
    shooterSprite.classList.add('runup');
    if (img) {
        setTimeout(() => {
            img.setAttribute('src', img.getAttribute('src').replace(/shooter(-\d)?\.png/, 'shooter-2.png'));
        }, 80);
    }
    setTimeout(() => {
        shooterSprite.classList.remove('runup');
        shooterSprite.classList.add('kicking');
        if (img) img.setAttribute('src', img.getAttribute('src').replace(/shooter(-\d)?\.png/, 'shooter-3.png'));
    }, 380);
    setTimeout(() => {
        shooterSprite.classList.add('impact');
        triggerScreenShake();
        triggerImpactFlash();
        onKick();
        setTimeout(() => {
            shooterSprite.classList.remove('kicking', 'impact');
            if (img) img.setAttribute('src', img.getAttribute('src').replace(/shooter(-\d)?\.png/, 'shooter.png'));
        }, 400);
    }, 560);
}

function triggerScreenShake() {
    const field = document.getElementById('field');
    field.classList.remove('screen-shake');
    void field.offsetWidth;
    field.classList.add('screen-shake');
    setTimeout(() => field.classList.remove('screen-shake'), 420);
}

function triggerImpactFlash() {
    let flashEl = document.getElementById('impactFlashOverlay');
    if (!flashEl) {
        flashEl = document.createElement('div');
        flashEl.id = 'impactFlashOverlay';
        flashEl.style.cssText = `
            position:absolute; inset:0; z-index:45; pointer-events:none;
            background:radial-gradient(ellipse 60% 40% at 42% 75%,
                rgba(255,255,220,0.55) 0%, rgba(255,200,0,0.18) 50%, transparent 80%);
            opacity:0;
        `;
        document.getElementById('field').appendChild(flashEl);
    }
    flashEl.style.transition = 'none';
    flashEl.style.opacity    = '1';
    requestAnimationFrame(() => {
        flashEl.style.transition = 'opacity 0.35s ease-out';
        flashEl.style.opacity    = '0';
    });
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
            applyBallPerspective(t, `translateX(-50%) rotate(${t*720}deg)`);
            if (t < 1) { requestAnimationFrame(animFrame); }
            else { showFlash('OUT! ❌', 'miss-flash'); cb(); }
        }
        requestAnimationFrame(animFrame);
    });
}

function animateShotToGoal(shotZone, keeperZone, power, cb) {
    const target    = BALL_ZONE_POS[shotZone];
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
        let totalRot = 0;
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
            totalRot = t * 360 * (1.5 + speedFactor * 0.5);
            applyBallPerspective(t, `translateX(-50%) rotate(${totalRot}deg)`);
            if (t < 1) {
                requestAnimationFrame(animFrame);
            } else {
                setTimeout(() => {
                    const saved = isZoneSaved(shotZone, keeperZone);
                    const zEl = document.querySelector(`.zone[data-zone="${shotZone}"]`);
                    zEl.classList.remove('target');
                    if (saved) {
                        zEl.classList.add('saved');
                        showFlash('SAVED! 🧤', 'miss-flash');
                        animateBallRebound(bx, by, fieldRect, totalRot, () => cb(false));
                    } else {
                        zEl.classList.add('scored');
                        showFlash('GOAL! ⚽', 'goal-flash');
                        animateBallRollInNet(bx, by, totalRot, () => cb(true));
                    }
                }, 60);
            }
        }
        requestAnimationFrame(animFrame);
    });
}

function animateBallRebound(impactX, impactY, fieldRect, startRot, cb) {
    const floorY    = fieldRect.height - fieldRect.height * 0.13;
    const bounceDamp = 0.50;
    const rollFric   = 0.82;
    const gravity    = 1400;
    let vx = (Math.random() - 0.5) * 320;
    let vy = -(280 + Math.random() * 140);
    let cx = impactX, cy = impactY;
    let rot = startRot;
    let bounceCount = 0;
    const maxBounces = 5;
    let lastTime = performance.now();
    function estimateT(curY) {
        return Math.max(0, Math.min(1, 1 - (curY - impactY) / (floorY - impactY)));
    }
    function tick(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.04);
        lastTime = now;
        vy += gravity * dt;
        cx += vx * dt;
        cy += vy * dt;
        const tPersp = estimateT(cy);
        applyBallPerspective(tPersp);
        if (cy >= floorY) {
            cy = floorY;
            vy = -Math.abs(vy) * bounceDamp;
            vx *= rollFric;
            bounceCount++;
            if (Math.abs(vy) < 30 || bounceCount >= maxBounces) {
                animateBallRollToStop(cx, cy, vx, rot, cb);
                return;
            }
        }
        const squash = cy >= floorY - 2 ? 'scaleY(0.75) scaleX(1.18)' : '';
        rot += vx * dt * 3.5;
        ball.style.left      = cx + 'px';
        ball.style.top       = cy + 'px';
        ball.style.bottom    = 'auto';
        ball.style.transform = `translateX(-50%) rotate(${rot}deg) ${squash}`;
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function animateBallRollToStop(startX, startY, initVx, startRot, cb) {
    let cx  = startX, cy = startY;
    let vx  = initVx;
    let rot = startRot;
    const frictionPS = 3.2;
    let lastTime = performance.now();
    function tick(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.04);
        lastTime = now;
        const sign = vx > 0 ? 1 : -1;
        vx -= sign * frictionPS * 60 * dt;
        if (sign !== (vx > 0 ? 1 : -1)) vx = 0;
        cx  += vx * dt;
        rot += vx * dt * 2.8;
        ball.style.left      = cx + 'px';
        ball.style.top       = cy + 'px';
        ball.style.bottom    = 'auto';
        ball.style.transform = `translateX(-50%) rotate(${rot}deg)`;
        if (Math.abs(vx) > 2) {
            requestAnimationFrame(tick);
        } else {
            ball.classList.remove('flying');
            cb();
        }
    }
    requestAnimationFrame(tick);
}

function animateBallRollInNet(impactX, impactY, startRot, cb) {
    const NET_SCALE  = perspectiveScale(1.0);
    const BASE_SIZE  = 160;
    const ballSizePx = Math.round(BASE_SIZE * NET_SCALE);
    const bounceDamp = 0.48;
    const rollFric   = 0.78;
    const gravity    = 1800;
    let vx = (Math.random() - 0.5) * 120;
    let vy = -(160 + Math.random() * 80);
    let cx = impactX, cy = impactY;
    let rot = startRot;
    let bounceCount = 0;
    const maxBounces = 6;
    let lastTime = performance.now();
    ball.style.width  = ballSizePx + 'px';
    ball.style.height = ballSizePx + 'px';
    function tick(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.04);
        lastTime = now;
        vy += gravity * dt;
        cx += vx * dt;
        cy += vy * dt;
        const goalNet    = document.querySelector('.goal-net');
        const gRect      = goalNet.getBoundingClientRect();
        const fieldRect  = document.getElementById('field').getBoundingClientRect();
        const netFloorY  = gRect.bottom - fieldRect.top - ballSizePx * 0.5;
        const netLeft    = gRect.left - fieldRect.left + ballSizePx * 0.5;
        const netRight   = gRect.right - fieldRect.left - ballSizePx * 0.5;
        if (cx < netLeft)  { cx = netLeft;  vx = Math.abs(vx) * 0.55; }
        if (cx > netRight) { cx = netRight; vx = -Math.abs(vx) * 0.55; }
        if (cy >= netFloorY) {
            cy = netFloorY;
            vy = -Math.abs(vy) * bounceDamp;
            vx *= rollFric;
            bounceCount++;
            if (Math.abs(vy) < 25 || bounceCount >= maxBounces) {
                animateBallRollToStop(cx, cy, vx * 0.4, rot, cb);
                return;
            }
        }
        const squash = cy >= netFloorY - 3 ? 'scaleY(0.72) scaleX(1.2)' : '';
        rot += vx * dt * 4.2;
        ball.style.left      = cx + 'px';
        ball.style.top       = cy + 'px';
        ball.style.bottom    = 'auto';
        ball.style.transform = `translateX(-50%) rotate(${rot}deg) ${squash}`;
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function easeInOutQuart(t) {
    return t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t+2, 4)/2;
}

function perspectiveScale(t) {
    const BIG   = 1.0;
    const SMALL = 0.75;
    return BIG + (SMALL - BIG) * t;
}

function applyBallPerspective(t, extraTransform) {
    const BASE_SIZE = 160;
    const s = perspectiveScale(t);
    const sz = Math.round(BASE_SIZE * s);
    ball.style.width  = sz + 'px';
    ball.style.height = sz + 'px';
    if (extraTransform !== undefined) {
        ball.style.transform = extraTransform;
    }
    const shadowSize = Math.round(4 + s * 8);
    ball.style.filter = `drop-shadow(0 ${shadowSize}px ${shadowSize * 2}px rgba(0,0,0,0.7))`;
}

// ════════════════════════════════════════════════════════
// KEEPER MODE
// ════════════════════════════════════════════════════════
function keeperTurn(keeperZone) {
    if (busy) return;
    busy = true;
    setInputEnabled(false);
    actionHint.textContent = '';
    const botShotZone = botDecideShot();
    animateBotShotToGoal(botShotZone, keeperZone, (botScored) => {
        if (botScored) { botScore++; botHistory.push('goal'); }
        else           { botHistory.push('miss'); }
        if (!botScored) { playerScore++; playerHistory.push('goal'); }
        else            { playerHistory.push('miss'); }
        round++;
        updateScoreboard();
        setTimeout(beginRound, 900);
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
    const target    = BALL_ZONE_POS[botZone];
    const goalNet   = document.querySelector('.goal-net');
    const gRect     = goalNet.getBoundingClientRect();
    const fieldRect = document.getElementById('field').getBoundingClientRect();
    const bx = gRect.left - fieldRect.left + gRect.width  * (target.l / 100);
    const by = gRect.top  - fieldRect.top  + gRect.height * (1 - target.b / 100);
    runShooterAnim(() => {
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
            applyBallPerspective(t, `translateX(-50%) rotate(${t*540}deg)`);
            if (t < 1) {
                requestAnimationFrame(animFrame);
            } else {
                setTimeout(() => {
                    const saved = isZoneSaved(botZone, keeperZone);
                    const zEl = document.querySelector(`.zone[data-zone="${botZone}"]`);
                    zEl.classList.remove('target');
                    if (saved) { zEl.classList.add('saved'); showFlash('GREAT SAVE! 🧤', 'save-flash'); animateBallRebound(bx, by, fieldRect, t*540, () => cb(false)); }
                    else { zEl.classList.add('scored'); showFlash('BOT SCORES! ⚽', 'miss-flash'); animateBallRollInNet(bx, by, t*540, () => cb(true)); }
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
    ball.style.width      = '160px';
    ball.style.height     = '160px';
    ball.style.filter     = 'drop-shadow(0 4px 8px rgba(0,0,0,0.7))';
    ball.style.transform  = 'translateX(-50%)';
    ball.classList.remove('flying');
    keeper.classList.remove('diving');
    keeper.style.transition = 'none';
    keeper.style.left       = '50%';
    keeper.style.bottom     = '0%';
    keeper.style.transform  = 'translateX(-50%)';
    setKeeperPose('stand');
    shooterSprite.classList.remove('runup','kicking','impact');
    const shooterImg = shooterSprite.querySelector('img');
    if (shooterImg) shooterImg.setAttribute('src', shooterImg.getAttribute('src').replace(/shooter(-\d)?\.png/, 'shooter.png'));
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
    const screenResultEl = document.getElementById('screenResult');
    if (!screenResultEl.querySelector('.result-bg')) {
        const bg = document.createElement('div');
        bg.className = 'result-bg';
        bg.style.backgroundImage = "url('../../assets/images/penalty/ketqua.png')";
        const vignette = document.createElement('div');
        vignette.className = 'result-vignette';
        screenResultEl.insertBefore(vignette, screenResultEl.firstChild);
        screenResultEl.insertBefore(bg, screenResultEl.firstChild);
    }
    setTimeout(() => showScreen('screenResult'), 700);
}

// ── NAV ─────────────────────────────────────────────────
function rematch()  { startGame(mode); }
function goMode()   { stopTraining(); removeKeyControls(); showScreen('screenMode'); }
function goLobby()  { stopTraining(); window.location.href = '../../index.html'; }


// ════════════════════════════════════════════════════════
// TRAINING MODE
// ════════════════════════════════════════════════════════

const TR_IMG = p => `../../assets/images/penalty/training/${p}`;

const TR_SPEED            = 8;
const TR_SPRITE_MS        = 350;
const TR_SCALE            = 0.25;
const TR_VISUAL_W         = 1820 * TR_SCALE;   // ~455px
const TR_SHOOT_DURATION   = 700;
const TR_BALL_SPEED_MIN   = 8;
const TR_BALL_SPEED_MAX   = 28;
const TR_BALL_SIZE        = 116;
const TR_BALL_LIFETIME    = 3000;
const TR_FIELD_BOTTOM     = 0.08;
const TR_XOAC_DURATION    = 800;
const TR_XOAC_RANGE       = 200;
const TR_XOAC_COOLDOWN    = 3000;
const TR_POWER_CHARGE_MS  = 1200;
const TR_POWER_MIN        = 0.35;
const TR_INTRUDER_MIN_DELAY  = 5000;
const TR_INTRUDER_MAX_DELAY  = 6000;
const TR_INTRUDER_SPEED      = 14;
const TR_INTRUDER_TACKLE_RANGE = 80;
const TR_Y_MIN = 0;
const TR_Y_MAX = 220;
const TR_VERTICAL_SPEED_FACTOR = 0.7;

const TR_CHARACTERS = [
    { id:'noxx',  idle: TR_IMG('2-noxx.png'),         run: TR_IMG('2-noxx-running.png'),  shoot: TR_IMG('2-noxx-shoot.png'),  xoac: TR_IMG('2-noxx-xoac.png'),  startDir: 1,  speed: 8  },
    { id:'xeali', idle: TR_IMG('2-xeali.png'),        run: TR_IMG('2-xeali-running.png'), shoot: TR_IMG('2-xeali-shoot.png'), xoac: TR_IMG('2-xeali-xoac.png'), startDir: -1, speed: 6  },
    { id:'lyron', idle: TR_IMG('2-lyron.png'),        run: TR_IMG('2-lyron-running.png'),  shoot: TR_IMG('2-lyron-shoot.png'), xoac: TR_IMG('2-lyron-xoac.png'), startDir: 1,  speed: 10 },
];

let trPlayers = [];
let trActiveIndex = 0;
let trKeys = { left: false, right: false, up: false, down: false, d: false };
let trChargeStart = null;
let trLastActiveX = null;
let trLastActiveY = null;
let trShakeTimer  = null;
let trLoopRAF     = null;
let trSpriteInterval = null;
let trRunning = false;

const trIntruder = {
    active: false, index: null, phase: null,
    phaseUntil: 0, tackleHit: false,
    spriteFrame: 0, spriteInterval: null,
};

function stopTraining() {
    trRunning = false;
    if (trLoopRAF)        { cancelAnimationFrame(trLoopRAF); trLoopRAF = null; }
    if (trSpriteInterval) { clearInterval(trSpriteInterval); trSpriteInterval = null; }
    trStopIntruderAnim();
    document.removeEventListener('keydown', trOnKeyDown);
    document.removeEventListener('keyup',   trOnKeyUp);
    // Clean up any flying balls
    trPlayers.forEach(p => {
        if (p.shotBall) { p.shotBall.remove(); p.shotBall = null; p.shotState = null; }
    });
    trStopLED();
}

// ── LED banner ─────────────────────────────────────────
let trLedRAF = null;
function trStopLED() {
    if (trLedRAF) { cancelAnimationFrame(trLedRAF); trLedRAF = null; }
}

function trInitLED() {
    trStopLED();
    const SEGMENTS = [
        { text: 'SEISMIC',    color: null },
        { text: '  ✦  ',     color: '#ffffff' },
        { text: 'Encrypted',  color: '#00ffee' },
        { text: '  ✦  ',     color: '#ffffff' },
        { text: 'Privacy',    color: '#ff00cc' },
        { text: '  ✦  ',     color: '#ffffff' },
    ];
    const RANDOM_COLORS = ['#ff0040','#ff4400','#ffaa00','#ffee00','#00ffcc','#00aaff','#aa00ff','#ff00aa'];
    const SCROLL_SPEED = 1.6;
    const REPEAT = 6;
    const track = document.getElementById('tr-led-track');
    let charMeta = [];

    function buildTrack() {
        track.innerHTML = '';
        charMeta = [];
        for (let r = 0; r < REPEAT; r++) {
            SEGMENTS.forEach((seg, segIdx) => {
                for (const ch of seg.text) {
                    const span = document.createElement('span');
                    span.className = 'tr-led-char';
                    span.textContent = ch;
                    track.appendChild(span);
                    charMeta.push(segIdx);
                }
            });
        }
    }
    buildTrack();

    let unitWidth = 0;
    function measureUnit() {
        const fullLen = SEGMENTS.reduce((a, s) => a + s.text.length, 0);
        let w = 0;
        const children = track.children;
        for (let i = 0; i < fullLen && i < children.length; i++) w += children[i].offsetWidth;
        unitWidth = w || 400;
    }

    const colorState = [];
    function initColorState() {
        colorState.length = 0;
        for (let i = 0; i < track.children.length; i++) {
            colorState.push({ colorIdx: Math.floor(Math.random() * RANDOM_COLORS.length), phase: Math.random() * Math.PI * 2, speed: 0.018 + Math.random() * 0.022 });
        }
    }
    initColorState();

    let offset = 0, frame = 0;
    function animLED() {
        if (!trRunning) return;
        frame++;
        offset += SCROLL_SPEED;
        if (unitWidth > 0 && offset >= unitWidth) offset -= unitWidth;
        track.style.transform = 'translateX(' + (-offset) + 'px)';
        const children = track.children;
        for (let i = 0; i < children.length; i++) {
            const s = colorState[i];
            s.phase += s.speed;
            const bright = 0.75 + 0.25 * Math.sin(s.phase);
            const seg = SEGMENTS[charMeta[i]];
            let col;
            if (seg && seg.color) { col = seg.color; }
            else {
                if (frame % 80 === (i * 13) % 80) s.colorIdx = (s.colorIdx + 1) % RANDOM_COLORS.length;
                col = RANDOM_COLORS[s.colorIdx];
            }
            children[i].style.color   = col;
            children[i].style.opacity = bright.toFixed(2);
        }
        trLedRAF = requestAnimationFrame(animLED);
    }
    requestAnimationFrame(() => { measureUnit(); trLedRAF = requestAnimationFrame(animLED); });
}

// ── Helpers ─────────────────────────────────────────────
function trGetBottomY() {
    const p = trPlayers[trActiveIndex];
    const baseBottom = window.innerHeight - window.innerHeight * TR_FIELD_BOTTOM;
    return baseBottom - (p ? p.y : 0);
}

function trApplyFlip(p) {
    p.group.style.transform = p.direction === 1 ? 'scaleX(1)' : 'scaleX(-1)';
}

function trSetSpritePose(p, src, isXoacPose) {
    p.spriteEl.src = src;
    p.spriteEl.classList.toggle('xoac-pose', !!isXoacPose);
}

function trShakeScreen(intensity, duration) {
    const start = Date.now();
    if (trShakeTimer) clearInterval(trShakeTimer);
    trShakeTimer = setInterval(() => {
        const elapsed = Date.now() - start;
        if (elapsed >= duration) {
            clearInterval(trShakeTimer);
            trShakeTimer = null;
            document.body.style.transform = 'translate(0px, 0px)';
            return;
        }
        const decay = 1 - elapsed / duration;
        const dx = (Math.random() - 0.5) * 2 * intensity * decay;
        const dy = (Math.random() - 0.5) * 2 * intensity * decay;
        document.body.style.transform = `translate(${dx}px, ${dy}px)`;
    }, 16);
}

function trFlipSprite(p) {
    if (p.isShooting || p.isXoac) return;
    p.spriteFrame = 1 - p.spriteFrame;
    trSetSpritePose(p, p.spriteFrame === 0 ? p.cfg.idle : p.cfg.run, false);
}

function trDoXoac(p, targetBall, targetState) {
    if (p.isXoac || p.isShooting || Date.now() < p.xoacCooldown) return;
    p.isXoac = true;
    trSetSpritePose(p, p.cfg.xoac, true);
    p.ballEl.style.visibility = 'hidden';
    const ballCenterX = targetState.x + TR_BALL_SIZE / 2;
    const playerCenterX = p.x + TR_VISUAL_W / 2;
    p.direction = ballCenterX >= playerCenterX ? 1 : -1;
    trApplyFlip(p);
    const kickDir2  = -p.direction;
    const kSpeed2   = 14 + Math.random() * 8;
    const kAngle2   = (Math.PI * 0.3) + Math.random() * (Math.PI * 0.2);
    targetState.vx  = kickDir2 * Math.cos(kAngle2) * kSpeed2;
    targetState.vy  = -Math.abs(Math.sin(kAngle2) * kSpeed2);
    targetState.bouncing      = true;
    targetState.bounceGravity = 1.4;
    targetState.bounceDecay   = 0.72;
    targetState.bounceCount   = 0;
    targetState.floorY = window.innerHeight - TR_BALL_SIZE - 20;
    setTimeout(() => {
        p.isXoac = false;
        p.xoacCooldown = Date.now() + TR_XOAC_COOLDOWN;
        trSetSpritePose(p, p.cfg.idle, false);
        p.ballEl.style.visibility = 'visible';
    }, TR_XOAC_DURATION);
}

function trDoSelfXoac(p) {
    if (p.isXoac || p.isShooting || Date.now() < p.xoacCooldown) return;
    p.isXoac = true;
    trSetSpritePose(p, p.cfg.xoac, true);
    p.ballEl.style.visibility = 'hidden';
    if (p.shotState && p.shotBall) {
        const ballCX = p.shotState.x + TR_BALL_SIZE / 2;
        const playerCX = p.x + TR_VISUAL_W / 2;
        const ballCY = p.shotState.y + TR_BALL_SIZE / 2;
        const playerCY = trGetBottomY() - 60;
        const dist = Math.hypot(ballCX - playerCX, ballCY - playerCY);
        if (dist < TR_XOAC_RANGE) {
            p.shotState.vx = -p.shotState.vx * 0.8 + (Math.random() - 0.5) * 4;
            p.shotState.vy = -Math.abs(p.shotState.vy) * 0.6 - Math.random() * 4;
        }
    }
    setTimeout(() => {
        p.isXoac = false;
        p.xoacCooldown = Date.now() + TR_XOAC_COOLDOWN;
        trSetSpritePose(p, p.cfg.idle, false);
        p.ballEl.style.visibility = 'visible';
    }, TR_XOAC_DURATION);
}

// ── Intruder ─────────────────────────────────────────────
function trStartIntruderRunAnim(ip) {
    trStopIntruderAnim();
    trIntruder.spriteFrame = 0;
    trSetSpritePose(ip, ip.cfg.idle, false);
    trIntruder.spriteInterval = setInterval(() => {
        if (!trIntruder.active || trIntruder.phase === 'tackling') return;
        trIntruder.spriteFrame = 1 - trIntruder.spriteFrame;
        trSetSpritePose(ip, trIntruder.spriteFrame === 0 ? ip.cfg.idle : ip.cfg.run, false);
    }, TR_SPRITE_MS);
}

function trStopIntruderAnim() {
    if (trIntruder.spriteInterval) { clearInterval(trIntruder.spriteInterval); trIntruder.spriteInterval = null; }
}

function trScheduleIntruder() {
    const delay = TR_INTRUDER_MIN_DELAY + Math.random() * (TR_INTRUDER_MAX_DELAY - TR_INTRUDER_MIN_DELAY);
    setTimeout(() => { if (trRunning) trTriggerIntruder(); }, delay);
}

function trTriggerIntruder() {
    const activePlayer = trPlayers[trActiveIndex];
    if (trIntruder.active || activePlayer.isXoac || activePlayer.isShooting) {
        trScheduleIntruder(); return;
    }
    const candidates = trPlayers.map((_, i) => i).filter(i => i !== trActiveIndex);
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    const ip = trPlayers[idx];
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const bottomPx = screenH * TR_FIELD_BOTTOM;
    const fromLeft = Math.random() < 0.5;
    ip.x = fromLeft ? -TR_VISUAL_W : screenW;
    ip.y = activePlayer.y;
    ip.direction = fromLeft ? 1 : -1;
    ip.isShooting = false;
    ip.isXoac = false;
    trSetSpritePose(ip, ip.cfg.run, false);
    ip.ballEl.style.visibility = 'hidden';
    trApplyFlip(ip);
    ip.group.style.display = 'flex';
    ip.group.style.left   = ip.x + 'px';
    ip.group.style.bottom = (bottomPx + ip.y) + 'px';
    trIntruder.active = true;
    trIntruder.index  = idx;
    trIntruder.phase  = 'running';
    trIntruder.phaseUntil = 0;
    trStartIntruderRunAnim(ip);
}

function trUpdateIntruder() {
    if (!trIntruder.active) return;
    const ip = trPlayers[trIntruder.index];
    const activePlayer = trPlayers[trActiveIndex];
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const bottomPx = screenH * TR_FIELD_BOTTOM;
    const now = Date.now();

    if (trIntruder.phase === 'running') {
        let targetX, targetY;
        if (activePlayer.shotState && activePlayer.shotBall) {
            targetX = activePlayer.shotState.x + TR_BALL_SIZE / 2 - TR_VISUAL_W / 2;
            const ballScreenY = activePlayer.shotState.y;
            const floorScreenY = window.innerHeight - window.innerHeight * TR_FIELD_BOTTOM;
            const estimatedY = Math.max(TR_Y_MIN, Math.min(TR_Y_MAX, floorScreenY - ballScreenY - TR_BALL_SIZE));
            targetY = estimatedY;
        } else {
            targetX = activePlayer.x;
            targetY = activePlayer.y;
        }
        const dx = targetX - ip.x;
        const dy = targetY - ip.y;
        const dist2D = Math.hypot(dx, dy);
        if (Math.abs(dx) <= TR_INTRUDER_TACKLE_RANGE) {
            trIntruder.phase = 'tackling';
            trIntruder.phaseUntil = now + TR_XOAC_DURATION;
            trIntruder.tackleHit = Math.random() < 0.5;
            ip.direction = activePlayer.x >= ip.x ? 1 : -1;
            trApplyFlip(ip);
            trStopIntruderAnim();
            trSetSpritePose(ip, ip.cfg.xoac, true);
            ip.ballEl.style.visibility = 'hidden';
            if (trIntruder.tackleHit) {
                if (activePlayer.shotState && activePlayer.shotBall) {
                    const ballCX = activePlayer.shotState.x + TR_BALL_SIZE / 2;
                    const ipCX   = ip.x + TR_VISUAL_W / 2;
                    const ballCY = activePlayer.shotState.y + TR_BALL_SIZE / 2;
                    const ipCY   = trGetBottomY() - 60;
                    const bDist = Math.hypot(ballCX - ipCX, ballCY - ipCY);
                    if (bDist < TR_XOAC_RANGE * 2) {
                        const kickDir = -ip.direction;
                        const kickSpeed = 18 + Math.random() * 10;
                        const kickAngle = (Math.PI * 0.25) + Math.random() * (Math.PI * 0.25);
                        activePlayer.shotState.vx = kickDir * Math.cos(kickAngle) * kickSpeed;
                        activePlayer.shotState.vy = -Math.abs(Math.sin(kickAngle) * kickSpeed);
                        activePlayer.shotState.bouncing      = true;
                        activePlayer.shotState.bounceGravity = 1.4;
                        activePlayer.shotState.bounceDecay   = 0.72;
                        activePlayer.shotState.bounceCount   = 0;
                        activePlayer.shotState.floorY = window.innerHeight - TR_BALL_SIZE - 20;
                        trShakeScreen(7, 300);
                    }
                }
            } else {
                trShakeScreen(3, 150);
            }
        } else {
            if (dist2D > 0) {
                ip.x += (dx / dist2D) * TR_INTRUDER_SPEED;
                ip.y += (dy / dist2D) * TR_INTRUDER_SPEED * TR_VERTICAL_SPEED_FACTOR;
                ip.y = Math.max(TR_Y_MIN, Math.min(TR_Y_MAX, ip.y));
            }
            const newDir = dx >= 0 ? 1 : -1;
            if (ip.direction !== newDir) { ip.direction = newDir; trApplyFlip(ip); }
        }
    } else if (trIntruder.phase === 'tackling') {
        if (now >= trIntruder.phaseUntil) {
            trIntruder.phase = 'leaving';
            trStartIntruderRunAnim(ip);
            ip.ballEl.style.visibility = 'hidden';
        }
    } else if (trIntruder.phase === 'leaving') {
        ip.x += TR_INTRUDER_SPEED * ip.direction;
        const offscreen = (ip.direction === 1 && ip.x > screenW + TR_VISUAL_W)
                        || (ip.direction === -1 && ip.x < -TR_VISUAL_W * 2);
        if (offscreen) {
            ip.group.style.display = 'none';
            trSetSpritePose(ip, ip.cfg.idle, false);
            ip.ballEl.style.visibility = 'visible';
            ip.isXoac = false;
            ip.isShooting = false;
            trStopIntruderAnim();
            trIntruder.active = false;
            trIntruder.index  = null;
            trIntruder.phase  = null;
            trScheduleIntruder();
            return;
        }
    }
    ip.group.style.left   = ip.x + 'px';
    ip.group.style.bottom = (bottomPx + ip.y) + 'px';
}

// ── Shoot ────────────────────────────────────────────────
function trShoot(p, powerRatio) {
    if (p.isShooting) return;
    p.isShooting = true;
    const ballRect = p.ballEl.getBoundingClientRect();
    const startX = ballRect.left + ballRect.width  / 2 - TR_BALL_SIZE / 2;
    const startY = ballRect.top  + ballRect.height / 2 - TR_BALL_SIZE / 2;
    trSetSpritePose(p, p.cfg.shoot, false);
    p.ballEl.style.visibility = 'hidden';
    if (p.shotBall) { p.shotBall.remove(); p.shotBall = null; p.shotState = null; }
    const baseAngle = p.direction === 1 ? 0 : Math.PI;
    const spread = (Math.random() - 0.5) * (Math.PI / 2);
    const angle  = baseAngle + spread;
    const ratio = Math.max(TR_POWER_MIN, Math.min(1, powerRatio || TR_POWER_MIN));
    const speed = TR_BALL_SPEED_MIN + ratio * (TR_BALL_SPEED_MAX - TR_BALL_SPEED_MIN);
    const img = document.createElement('img');
    img.src = TR_IMG('2-ball.png');
    img.className = 'tr-shot-ball';
    img.style.display = 'block';
    img.style.left = startX + 'px';
    img.style.top  = startY + 'px';
    document.body.appendChild(img);
    p.shotBall = img;
    p.shotState = { x: startX, y: startY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, rotation: 0, alive: true };
    trShakeScreen(2 + ratio * 6, 250);
    setTimeout(() => {
        img.style.transition = 'opacity 0.5s';
        img.style.opacity = '0';
        setTimeout(() => { img.remove(); if (p.shotBall === img) { p.shotBall = null; p.shotState = null; } }, 500);
    }, TR_BALL_LIFETIME);
    setTimeout(() => {
        p.isShooting = false;
        trSetSpritePose(p, p.cfg.idle, false);
        p.ballEl.style.visibility = 'visible';
    }, TR_SHOOT_DURATION);
}

// ── Power bar (training) ─────────────────────────────────
function trShowPowerBar() {
    document.getElementById('tr-power-bar-container').style.display = 'block';
    document.getElementById('tr-power-bar-fill').style.width = '0%';
}
function trHidePowerBar() {
    document.getElementById('tr-power-bar-container').style.display = 'none';
    document.getElementById('tr-power-bar-fill').style.width = '0%';
}
function trUpdatePowerBar() {
    if (trChargeStart === null) return;
    const held = Date.now() - trChargeStart;
    const ratio = Math.min(1, held / TR_POWER_CHARGE_MS);
    document.getElementById('tr-power-bar-fill').style.width = (ratio * 100) + '%';
}

// ── Visibility ───────────────────────────────────────────
function trUpdateVisibility() {
    if (trIntruder.active) {
        const ip = trPlayers[trIntruder.index];
        trStopIntruderAnim();
        ip.group.style.display = 'none';
        trSetSpritePose(ip, ip.cfg.idle, false);
        ip.ballEl.style.visibility = 'visible';
        ip.isXoac = false; ip.isShooting = false;
        trIntruder.active = false; trIntruder.index = null; trIntruder.phase = null;
        trScheduleIntruder();
    }
    trPlayers.forEach((p, i) => {
        const isActive = i === trActiveIndex;
        p.group.style.display = isActive ? 'flex' : 'none';
        if (!isActive && p.shotBall) { p.shotBall.remove(); p.shotBall = null; p.shotState = null; }
        if (!isActive) { p.isShooting = false; p.isXoac = false; trSetSpritePose(p, p.cfg.idle, false); p.ballEl.style.visibility = 'visible'; }
    });
    document.querySelectorAll('.tr-char-thumb').forEach((el, i) => {
        el.classList.toggle('active', i === trActiveIndex);
    });
}

// ── Key handlers (training) ──────────────────────────────
function trOnKeyDown(e) {
    if (!trRunning) return;
    switch (e.key) {
        case 'ArrowLeft':  trKeys.left  = true; e.preventDefault(); break;
        case 'ArrowRight': trKeys.right = true; e.preventDefault(); break;
        case 'ArrowUp':    trKeys.up    = true; e.preventDefault(); break;
        case 'ArrowDown':  trKeys.down  = true; e.preventDefault(); break;
        case 'd': case 'D':
            if (!trKeys.d) { trKeys.d = true; trChargeStart = Date.now(); trShowPowerBar(); }
            e.preventDefault(); break;
        case 'a': case 'A':
            trDoSelfXoac(trPlayers[trActiveIndex]); e.preventDefault(); break;
    }
}
function trOnKeyUp(e) {
    if (!trRunning) return;
    switch (e.key) {
        case 'ArrowLeft':  trKeys.left  = false; break;
        case 'ArrowRight': trKeys.right = false; break;
        case 'ArrowUp':    trKeys.up    = false; break;
        case 'ArrowDown':  trKeys.down  = false; break;
        case 'd': case 'D':
            if (trKeys.d) {
                trKeys.d = false;
                const p = trPlayers[trActiveIndex];
                if (trChargeStart !== null) {
                    const held = Date.now() - trChargeStart;
                    const ratio = Math.min(1, held / TR_POWER_CHARGE_MS);
                    trShoot(p, ratio);
                }
                trChargeStart = null;
                trHidePowerBar();
            }
            break;
    }
}

// ── Init & loop ──────────────────────────────────────────
function trInit() {
    const screenH  = window.innerHeight;
    const screenW  = window.innerWidth;
    const bottomPx = screenH * TR_FIELD_BOTTOM;
    const centerX  = screenW / 2 - TR_VISUAL_W / 2;
    trPlayers.forEach(p => {
        p.x = centerX; p.y = 0; p.direction = 1;
        trApplyFlip(p);
        p.group.style.bottom = bottomPx + 'px';
        p.group.style.left   = p.x + 'px';
    });
    trLastActiveX = null; trLastActiveY = null;
    trUpdateVisibility();
}

function trLoop() {
    if (!trRunning) return;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const minX = 0;
    const maxX = screenW - TR_VISUAL_W;
    const p = trPlayers[trActiveIndex];

    trUpdatePowerBar();
    trUpdateIntruder();

    // Auto-xoac by bounced ball
    if (!p.isXoac && !p.isShooting && Date.now() >= p.xoacCooldown && p.shotState && p.shotBall) {
        const ballCX = p.shotState.x + TR_BALL_SIZE / 2;
        const playerCX = p.x + TR_VISUAL_W / 2;
        const ballCY = p.shotState.y + TR_BALL_SIZE / 2;
        const playerCY = trGetBottomY() - 60;
        const dist = Math.hypot(ballCX - playerCX, ballCY - playerCY);
        if (dist < TR_XOAC_RANGE && Math.random() < 0.04) trDoXoac(p, p.shotBall, p.shotState);
    }

    // Move character
    if (!p.isShooting && !p.isXoac) {
        if (trKeys.left && !trKeys.right)  { p.x -= p.cfg.speed; if (p.direction !== -1) { p.direction = -1; trApplyFlip(p); } }
        else if (trKeys.right && !trKeys.left) { p.x += p.cfg.speed; if (p.direction !== 1)  { p.direction = 1;  trApplyFlip(p); } }
        if (trKeys.up   && !trKeys.down)   p.y += p.cfg.speed * TR_VERTICAL_SPEED_FACTOR;
        else if (trKeys.down && !trKeys.up) p.y -= p.cfg.speed * TR_VERTICAL_SPEED_FACTOR;
    }

    if (!p.isXoac) {
        p.x = Math.max(minX, Math.min(maxX, p.x));
        p.y = Math.max(TR_Y_MIN, Math.min(TR_Y_MAX, p.y));
    }

    const bottomPx = screenH * TR_FIELD_BOTTOM;
    p.group.style.left   = p.x + 'px';
    p.group.style.bottom = (bottomPx + p.y) + 'px';
    trLastActiveX = p.x; trLastActiveY = p.y;

    // Move shot ball
    if (p.shotState && p.shotBall) {
        if (p.shotState.bouncing) {
            const st = p.shotState;
            st.vy += st.bounceGravity;
            st.x += st.vx; st.y += st.vy;
            if (st.x <= 0) { st.x = 0; st.vx = Math.abs(st.vx) * 0.85; }
            else if (st.x + TR_BALL_SIZE >= screenW) { st.x = screenW - TR_BALL_SIZE; st.vx = -Math.abs(st.vx) * 0.85; }
            if (st.y <= 0) { st.y = 0; st.vy = Math.abs(st.vy) * 0.5; }
            if (st.y >= st.floorY) {
                st.y = st.floorY; st.vy = -Math.abs(st.vy) * st.bounceDecay; st.vx *= 0.88; st.bounceCount++;
                if (st.bounceCount >= 5 || Math.abs(st.vy) < 1.5) { st.bouncing = false; st.vy = 0; st.vx = (Math.random() - 0.5) * 3; }
            }
            st.rotation += 15 * Math.sign(st.vx || 1);
            p.shotBall.style.left      = st.x + 'px';
            p.shotBall.style.top       = st.y + 'px';
            p.shotBall.style.transform = `rotate(${st.rotation}deg) scale(${1 + Math.max(0, -st.vy) * 0.012})`;
        } else {
            p.shotState.x += p.shotState.vx; p.shotState.y += p.shotState.vy;
            if (p.shotState.x <= 0) { p.shotState.x = 0; p.shotState.vx = Math.abs(p.shotState.vx); }
            else if (p.shotState.x + TR_BALL_SIZE >= screenW) { p.shotState.x = screenW - TR_BALL_SIZE; p.shotState.vx = -Math.abs(p.shotState.vx); }
            if (p.shotState.y <= 0) { p.shotState.y = 0; p.shotState.vy = Math.abs(p.shotState.vy); }
            else if (p.shotState.y + TR_BALL_SIZE >= screenH) { p.shotState.y = screenH - TR_BALL_SIZE; p.shotState.vy = -Math.abs(p.shotState.vy); }
            p.shotState.rotation += 10 * Math.sign(p.shotState.vx || 1);
            p.shotBall.style.left      = p.shotState.x + 'px';
            p.shotBall.style.top       = p.shotState.y + 'px';
            p.shotBall.style.transform = `rotate(${p.shotState.rotation}deg)`;
        }
    }

    trLoopRAF = requestAnimationFrame(trLoop);
}

// ── Main init function called by startGame('training') ──
function initTraining() {
    // Build player state from DOM
    trPlayers = TR_CHARACTERS.map(cfg => ({
        cfg,
        group:    document.getElementById(`tr-group-${cfg.id}`),
        spriteEl: document.getElementById(`tr-sprite-${cfg.id}`),
        ballEl:   document.getElementById(`tr-ball-${cfg.id}`),
        x: 0, y: 0,
        direction: cfg.startDir,
        spriteFrame: 0,
        isShooting: false, isXoac: false,
        xoacCooldown: 0,
        shotBall: null, shotState: null,
    }));

    trActiveIndex = 0;
    trKeys = { left: false, right: false, up: false, down: false, d: false };
    trChargeStart = null;
    trLastActiveX = null;
    trLastActiveY = null;
    trIntruder.active = false; trIntruder.index = null; trIntruder.phase = null;

    trRunning = true;

    trInit();
    trInitLED();
    trScheduleIntruder();

    document.removeEventListener('keydown', trOnKeyDown);
    document.removeEventListener('keyup',   trOnKeyUp);
    document.addEventListener('keydown', trOnKeyDown);
    document.addEventListener('keyup',   trOnKeyUp);

    // Character select
    document.querySelectorAll('.tr-char-thumb').forEach((el, i) => {
        el.onclick = () => {
            if (i === trActiveIndex) return;
            trActiveIndex = i;
            const currentX = trLastActiveX !== null ? trLastActiveX : (window.innerWidth / 2 - TR_VISUAL_W / 2);
            const currentY = trLastActiveY !== null ? trLastActiveY : 0;
            const bottomPx = window.innerHeight * TR_FIELD_BOTTOM;
            trPlayers[trActiveIndex].x = currentX;
            trPlayers[trActiveIndex].y = currentY;
            trPlayers[trActiveIndex].group.style.left   = currentX + 'px';
            trPlayers[trActiveIndex].group.style.bottom = (bottomPx + currentY) + 'px';
            trChargeStart = null;
            trHidePowerBar();
            trUpdateVisibility();
        };
    });

    // Sprite animation interval
    if (trSpriteInterval) clearInterval(trSpriteInterval);
    trSpriteInterval = setInterval(() => {
        if (!trRunning) return;
        const p = trPlayers[trActiveIndex];
        if (trKeys.left || trKeys.right) { trFlipSprite(p); }
        else if (!p.isShooting && !p.isXoac) { trSetSpritePose(p, p.cfg.idle, false); p.spriteFrame = 0; }
    }, TR_SPRITE_MS);

    trLoopRAF = requestAnimationFrame(trLoop);

    window.addEventListener('resize', () => { if (trRunning) trInit(); });
}