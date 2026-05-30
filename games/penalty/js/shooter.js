// ── SHOOTER ──────────────────────────────────────────────
// Quản lý sprite cầu thủ sút: animation chạy đà, cú đá, reset.
// Cũng chứa AI bot quyết định zone sút.

import { BOT_SHOT_WEIGHTS } from './config.js';

const shooterSprite = document.getElementById('shooterSprite');

// ── Animation chạy đà (phase 1) ──────────────────────────
export function shooterRunup() {
    shooterSprite.classList.remove('kicking');
    shooterSprite.classList.add('runup');
}

// ── Animation cú đá (phase 2) ────────────────────────────
export function shooterKick() {
    shooterSprite.classList.remove('runup');
    shooterSprite.classList.add('kicking');
}

// ── Reset về đứng yên ────────────────────────────────────
export function resetShooter() {
    shooterSprite.classList.remove('runup', 'kicking');
}

// ── AI: bot chọn zone sút theo trọng số ──────────────────
export function botDecideShot() {
    const total = BOT_SHOT_WEIGHTS.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < BOT_SHOT_WEIGHTS.length; i++) {
        r -= BOT_SHOT_WEIGHTS[i];
        if (r <= 0) return i;
    }
    return 8;
}

export { shooterSprite };
