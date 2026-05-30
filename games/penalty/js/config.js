// ── CONFIG ──────────────────────────────────────────────
export const TOTAL_ROUNDS = 5;

// Keeper AI accuracy per round (xác suất đoán đúng cột của bot thủ môn)
export const KEEPER_ACCURACY = [0.30, 0.35, 0.40, 0.42, 0.48];

// Bot shooter: trọng số zone (góc dưới ưu tiên)
export const BOT_SHOT_WEIGHTS = [2, 1, 2, 1, 0, 1, 3, 1, 3];

// Zone 0-8 → vị trí trong .goal-net (left%, bottom%)
// Hàng trên: 0,1,2 | Hàng giữa: 3,4,5 | Hàng dưới: 6,7,8
export const ZONE_POS = [
    { l: 16, b: 72 }, { l: 50, b: 72 }, { l: 84, b: 72 },
    { l: 16, b: 46 }, { l: 50, b: 46 }, { l: 84, b: 46 },
    { l: 16, b: 16 }, { l: 50, b: 16 }, { l: 84, b: 16 },
];
