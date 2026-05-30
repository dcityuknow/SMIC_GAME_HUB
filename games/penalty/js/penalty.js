// ── ENTRY POINT ──────────────────────────────────────────
// Import tất cả module, expose các hàm cần thiết ra window
// để HTML onclick="..." vẫn hoạt động bình thường.

'use strict';

import { startGame, rematch, goMode, goLobby } from './screen.js';
import { setKeeperPose } from './keeper.js';

// Init: keeper đứng tư thế mặc định khi load trang
setKeeperPose('stand');

// Expose ra global để HTML onclick dùng được
window.startGame = startGame;
window.rematch   = rematch;
window.goMode    = goMode;
window.goLobby   = goLobby;
