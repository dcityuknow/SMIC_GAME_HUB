'use strict';

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

// ── Main init function ──
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

// ── NAV ─────────────────────────────────────────────────
function goLobby() { stopTraining(); window.location.href = '../../football/index.html'; }

// ── BOOT ────────────────────────────────────────────────
initTraining();
