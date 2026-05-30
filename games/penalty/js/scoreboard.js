// ── SCOREBOARD ───────────────────────────────────────────
// Cập nhật HUD (điểm, round, dots), hiển thị flash kết quả.

import { TOTAL_ROUNDS } from './config.js';
import { state } from './state.js';
import {
    playerScoreEl, botScoreEl,
    playerDotsEl,  botDotsEl,
    sbRoundEl,     resultFlash,
} from './dom.js';

// ── Cập nhật toàn bộ HUD ─────────────────────────────────
export function updateScoreboard() {
    playerScoreEl.textContent = state.playerScore;
    botScoreEl.textContent    = state.botScore;
    sbRoundEl.textContent     = state.round < TOTAL_ROUNDS
        ? `ROUND ${state.round + 1}/${TOTAL_ROUNDS}`
        : 'FINAL';
    renderDots(playerDotsEl, state.playerHistory);
    renderDots(botDotsEl,    state.botHistory);
}

// ── Vẽ dots lịch sử penalty ──────────────────────────────
function renderDots(container, history) {
    container.innerHTML = '';
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
        const d = document.createElement('div');
        d.className = 'dot' + (history[i] ? ' ' + history[i] : '');
        container.appendChild(d);
    }
}

// ── Flash thông báo kết quả mỗi lượt ─────────────────────
export function showFlash(msg, cls) {
    resultFlash.textContent = msg;
    resultFlash.className   = 'result-flash ' + cls;
    setTimeout(() => resultFlash.classList.add('hidden'), 950);
}

// ── Ẩn flash ─────────────────────────────────────────────
export function hideFlash() {
    resultFlash.classList.add('hidden');
}
