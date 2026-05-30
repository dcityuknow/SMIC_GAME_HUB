// ── SCREEN / NAV ─────────────────────────────────────────
// Điều hướng giữa các màn hình, khởi động game.

import { state, resetState } from './state.js';
import { screenMode, screenGame, screenResult, zones, actionHint, playerLabel } from './dom.js';
import { updateScoreboard } from './scoreboard.js';
import { beginRound, resetAll, setInputEnabled } from './game.js';
import { shooterTurn, keeperTurn } from './game.js';
import { setKeeperPose } from './keeper.js';

// ── Chuyển màn hình ───────────────────────────────────────
export function showScreen(id) {
    [screenMode, screenGame, screenResult].forEach(s =>
        s.classList.toggle('hidden', s.id !== id)
    );
}

// ── Khởi động ván mới ─────────────────────────────────────
export function startGame(selectedMode) {
    resetState(selectedMode);
    playerLabel.textContent = 'YOU';

    if (state.mode === 'shooter') {
        actionHint.textContent = 'CLICK KHUNG THÀNH ĐỂ SÚT';
        zones.forEach(z => {
            z.onclick = () => shooterTurn(parseInt(z.dataset.zone));
        });
    } else {
        actionHint.textContent = 'CLICK KHUNG THÀNH ĐỂ BẮT BÓNG';
        zones.forEach(z => {
            z.onclick = () => keeperTurn(parseInt(z.dataset.zone));
        });
    }

    updateScoreboard();
    resetAll();
    setKeeperPose('stand');
    showScreen('screenGame');
    setTimeout(beginRound, 400);
}

// ── Rematch cùng mode ─────────────────────────────────────
export function rematch() {
    startGame(state.mode);
}

// ── Về màn chọn mode ──────────────────────────────────────
export function goMode() {
    showScreen('screenMode');
}

// ── Về lobby ─────────────────────────────────────────────
export function goLobby() {
    window.location.href = '../../index.html';
}
