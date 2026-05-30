// ── BALL ─────────────────────────────────────────────────
// Quản lý toàn bộ bóng: DOM ref, animation arc, reset.

import { field } from './dom.js';

const ball = document.getElementById('ball');

// ── Easing ───────────────────────────────────────────────
export function easeInOutQuart(t) {
    return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

// ── Reset bóng về vị trí ban đầu ─────────────────────────
export function resetBall() {
    ball.style.transition = 'none';
    ball.style.left       = '50%';
    ball.style.bottom     = '16%';
    ball.style.top        = 'auto';
    ball.style.transform  = 'translateX(-50%)';
    ball.classList.remove('flying');

    requestAnimationFrame(() => {
        ball.style.transition = 'all 0.42s cubic-bezier(.25,.46,.45,.94)';
    });
}

// ── Animate bóng bay từ chân cầu thủ đến zone mục tiêu ───
// targetPx: { x, y } pixel tuyệt đối trong field
// onDone: callback khi animation xong
export function animateBallToTarget(targetPx, onDone) {
    const fieldRect = field.getBoundingClientRect();

    const { bx, by } = targetPx;
    const arcHeight   = Math.max(60, (fieldRect.top + fieldRect.height - by) * 0.35);

    const sx = fieldRect.width * 0.5;
    const sy = fieldRect.height - fieldRect.height * 0.16;

    ball.style.transition = 'none';
    ball.classList.add('flying');

    const startTime = performance.now();
    const duration  = 480;

    function animFrame(now) {
        const t  = Math.min((now - startTime) / duration, 1);
        const et = easeInOutQuart(t);

        const cx   = sx + (bx - sx) * et;
        const arcT = 1 - Math.pow(2 * t - 1, 2);
        const cy   = sy + (by - sy) * et - arcHeight * arcT;

        ball.style.left      = cx + 'px';
        ball.style.top       = cy + 'px';
        ball.style.bottom    = 'auto';
        ball.style.transform = `translateX(-50%) rotate(${t * 360 * 1.5}deg)`;

        if (t < 1) {
            requestAnimationFrame(animFrame);
        } else {
            setTimeout(onDone, 60);
        }
    }

    requestAnimationFrame(animFrame);
}

// ── Tính pixel target từ zone + goal-net rect ─────────────
export function calcTargetPx(zonePos, shotZone) {
    const goalNet   = document.querySelector('.goal-net');
    const gRect     = goalNet.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    const target    = zonePos[shotZone];

    return {
        bx: gRect.left - fieldRect.left + gRect.width  * (target.l / 100),
        by: gRect.top  - fieldRect.top  + gRect.height * (1 - target.b / 100),
    };
}

export { ball };
