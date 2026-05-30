// ── GAME LOGIC ───────────────────────────────────────────
// Điều phối từng lượt: shooterTurn, keeperTurn, beginRound, endGame.

import { TOTAL_ROUNDS, ZONE_POS } from './config.js';
import { state } from './state.js';
import { zones, actionHint, resultTrophy, resultTitle, resultSub } from './dom.js';
import { resetBall, animateBallToTarget, calcTargetPx } from './ball.js';
import { resetKeeper, moveKeeperToZone, botDecideKeeper, keeper, zoneToDiveDir } from './keeper.js';
import { shooterRunup, shooterKick, resetShooter, botDecideShot } from './shooter.js';
import { updateScoreboard, showFlash, hideFlash } from './scoreboard.js';
import { showScreen } from './screen.js';

// ── Bật / tắt click vào zones ────────────────────────────
export function setInputEnabled(on) {
    zones.forEach(z => z.style.pointerEvents = on ? 'auto' : 'none');
}

// ── Xóa highlight zones sau mỗi lượt ─────────────────────
function clearZoneHighlights() {
    zones.forEach(z => z.classList.remove('target', 'saved', 'scored'));
}

// ── Reset vị trí bóng + keeper + shooter về ban đầu ──────
export function resetAll() {
    resetBall();
    resetKeeper();
    resetShooter();
}

// ── Bắt đầu lượt mới ─────────────────────────────────────
export function beginRound() {
    if (state.round >= TOTAL_ROUNDS) { endGame(); return; }

    state.busy = false;
    resetAll();
    clearZoneHighlights();
    updateScoreboard();
    setInputEnabled(true);
    hideFlash();

    actionHint.textContent = state.mode === 'shooter'
        ? 'CLICK VÀO KHUNG THÀNH ĐỂ SÚT'
        : 'CLICK VÀO KHUNG THÀNH ĐỂ BẮT BÓNG';
}

// ════════════════════════════════════════════════════════
// SHOOTER MODE — user sút, bot làm thủ môn
// ════════════════════════════════════════════════════════
export function shooterTurn(shotZone) {
    if (state.busy) return;
    state.busy = true;
    setInputEnabled(false);
    actionHint.textContent = '';

    const keeperZone = botDecideKeeper();

    // Phase 1: chạy đà
    shooterRunup();

    setTimeout(() => {
        // Phase 2: cú đá + keeper nhảy + bóng bay
        shooterKick();
        moveKeeperToZone(keeperZone, ZONE_POS);

        const targetPx = calcTargetPx(ZONE_POS, shotZone);
        document.querySelector(`.zone[data-zone="${shotZone}"]`).classList.add('target');

        animateBallToTarget(targetPx, () => {
            const saved = isZoneSaved(shotZone, keeperZone);
            const zEl   = document.querySelector(`.zone[data-zone="${shotZone}"]`);
            zEl.classList.remove('target');

            if (saved) {
                zEl.classList.add('saved');
                showFlash('SAVED! 🧤', 'miss-flash');
                state.playerHistory.push('miss');
            } else {
                zEl.classList.add('scored');
                showFlash('GOAL! ⚽', 'goal-flash');
                state.playerScore++;
                state.playerHistory.push('goal');
            }

            state.round++;
            updateScoreboard();
            setTimeout(beginRound, 1100);
        });

    }, 380);
}

// ════════════════════════════════════════════════════════
// KEEPER MODE — bot sút, user làm thủ môn
// ════════════════════════════════════════════════════════
export function keeperTurn(keeperZone) {
    if (state.busy) return;
    state.busy = true;
    setInputEnabled(false);
    actionHint.textContent = '';

    // User di chuyển keeper đến zone chọn
    moveKeeperToZone(keeperZone, ZONE_POS);

    // Bot quyết định zone sút
    const botShotZone = botDecideShot();
    const targetPx    = calcTargetPx(ZONE_POS, botShotZone);

    document.querySelector(`.zone[data-zone="${botShotZone}"]`).classList.add('target');
    keeper.classList.add('diving');

    animateBallToTarget(targetPx, () => {
        const saved = isZoneSaved(botShotZone, keeperZone);
        const zEl   = document.querySelector(`.zone[data-zone="${botShotZone}"]`);
        zEl.classList.remove('target');

        if (saved) {
            zEl.classList.add('saved');
            showFlash('GREAT SAVE! 🧤', 'save-flash');
            state.playerScore++;
            state.playerHistory.push('goal');
            state.botHistory.push('miss');
        } else {
            zEl.classList.add('scored');
            showFlash('BOT SCORES! ⚽', 'miss-flash');
            state.botScore++;
            state.botHistory.push('goal');
            state.playerHistory.push('miss');
        }

        state.round++;
        updateScoreboard();
        setTimeout(beginRound, 1100);
    });
}

// ── Logic cản bóng ────────────────────────────────────────
// Cùng zone → chặn chắc. Cùng hàng/cột → 38% cơ may chặn.
function isZoneSaved(shotZone, keeperZone) {
    if (shotZone === keeperZone) return true;
    const sameCol = (shotZone % 3) === (keeperZone % 3);
    const sameRow = Math.floor(shotZone / 3) === Math.floor(keeperZone / 3);
    if (sameCol || sameRow) return Math.random() < 0.38;
    return false;
}

// ── Kết thúc game ────────────────────────────────────────
function endGame() {
    let trophy, title;
    if      (state.playerScore > state.botScore) { trophy = '🏆'; title = 'YOU WIN!'; }
    else if (state.playerScore < state.botScore) { trophy = '😞'; title = 'BOT WINS!'; }
    else                                         { trophy = '🤝'; title = "IT'S A DRAW!"; }

    resultTrophy.textContent = trophy;
    resultTitle.textContent  = title;
    resultSub.textContent    = `${state.playerScore} – ${state.botScore}`;
    setTimeout(() => showScreen('screenResult'), 700);
}
