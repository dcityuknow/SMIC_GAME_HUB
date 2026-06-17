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
let round         = 0;
let playerScore   = 0;
let botScore      = 0;
let playerHistory = [];
let botHistory    = [];
let busy          = false;

// ── DOM REFS ────────────────────────────────────────────
const screenGame     = document.getElementById('screenGame');
const screenResult   = document.getElementById('screenResult');

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
    [screenGame, screenResult].forEach(s =>
        s.classList.toggle('hidden', s.id !== id)
    );
}

// ── START GAME ──────────────────────────────────────────
function startGame() {
    round         = 0;
    playerScore   = 0;
    botScore      = 0;
    playerHistory = [];
    botHistory    = [];
    busy          = false;
    playerLabel.textContent = 'YOU';

    zones.forEach(z => { z.onclick = () => keeperTurn(parseInt(z.dataset.zone)); });
    actionHint.textContent = 'CLICK VÀO KHUNG THÀNH ĐỂ BẮT BÓNG';

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
    resetBallAndKeeper();
    clearZoneHighlights();
    updateScoreboard();
    setInputEnabled(true);
    resultFlash.classList.add('hidden');
    actionHint.textContent = 'CLICK VÀO KHUNG THÀNH ĐỂ BẮT BÓNG';
}

// ════════════════════════════════════════════════════════
// KEEPER LOGIC
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
function rematch()  { startGame(); }
function goMode()   { window.location.href = '../index.html'; }
function goLobby()  { window.location.href = '../../index.html'; }

// ── BOOT ────────────────────────────────────────────────
startGame();
