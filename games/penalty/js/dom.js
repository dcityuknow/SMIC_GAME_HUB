// ── DOM REFS ─────────────────────────────────────────────
// Tất cả getElementById / querySelector tập trung ở đây.
// Các module khác import từ file này, không tự query DOM.

export const screenMode   = document.getElementById('screenMode');
export const screenGame   = document.getElementById('screenGame');
export const screenResult = document.getElementById('screenResult');

export const playerScoreEl = document.getElementById('playerScore');
export const botScoreEl    = document.getElementById('botScore');
export const playerDotsEl  = document.getElementById('playerDots');
export const botDotsEl     = document.getElementById('botDots');
export const sbRoundEl     = document.getElementById('sbRound');
export const playerLabel   = document.getElementById('playerLabel');

export const actionHint  = document.getElementById('actionHint');
export const resultFlash = document.getElementById('resultFlash');
export const actionPanel = document.getElementById('actionPanel');

export const resultTrophy = document.getElementById('resultTrophy');
export const resultTitle  = document.getElementById('resultTitle');
export const resultSub    = document.getElementById('resultSub');

export const zones = document.querySelectorAll('.zone');
export const field = document.getElementById('field');
