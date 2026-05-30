// ── KEEPER ───────────────────────────────────────────────
// Quản lý toàn bộ thủ môn: DOM refs, pose, reset, AI bot.

// ── DOM refs riêng của keeper ────────────────────────────
const keeper          = document.getElementById('keeper');
const keeperStand     = document.getElementById('keeperStand');
const keeperUp        = document.getElementById('keeperUp');
const keeperDown      = document.getElementById('keeperDown');
const keeperLeft      = document.getElementById('keeperLeft');
const keeperRight     = document.getElementById('keeperRight');
const keeperLeftUp    = document.getElementById('keeperLeftUp');
const keeperLeftDown  = document.getElementById('keeperLeftDown');
const keeperRightUp   = document.getElementById('keeperRightUp');
const keeperRightDown = document.getElementById('keeperRightDown');

const ALL_KEEPER_IMGS = [
    keeperStand, keeperUp, keeperDown,
    keeperLeft,  keeperRight,
    keeperLeftUp, keeperLeftDown,
    keeperRightUp, keeperRightDown,
];

// ── Zone → hướng nhảy ────────────────────────────────────
// Layout zones:
//   0(trái-trên)  1(giữa-trên)  2(phải-trên)
//   3(trái-giữa)  4(giữa-giữa)  5(phải-giữa)
//   6(trái-dưới)  7(giữa-dưới)  8(phải-dưới)
export function zoneToDiveDir(zone) {
    const dirs = [
        'left-up',   'up',    'right-up',
        'left',      'stand', 'right',
        'left-down', 'down',  'right-down',
    ];
    return dirs[zone] ?? 'stand';
}

// ── Đặt pose thủ môn ─────────────────────────────────────
export function setKeeperPose(dir) {
    keeper.classList.remove('dive-left', 'dive-right', 'dive-up', 'dive-down');
    ALL_KEEPER_IMGS.forEach(img => img && img.classList.remove('active'));

    const map = {
        stand:       { img: keeperStand,      cls: null          },
        up:          { img: keeperUp,          cls: 'dive-up'     },
        down:        { img: keeperDown,        cls: 'dive-down'   },
        left:        { img: keeperLeft,        cls: 'dive-left'   },
        right:       { img: keeperRight,       cls: 'dive-right'  },
        'left-up':   { img: keeperLeftUp,      cls: 'dive-left'   },
        'left-down': { img: keeperLeftDown,    cls: 'dive-left'   },
        'right-up':  { img: keeperRightUp,     cls: 'dive-right'  },
        'right-down':{ img: keeperRightDown,   cls: 'dive-right'  },
    };

    const pose = map[dir] || map['stand'];
    if (pose.img) pose.img.classList.add('active');
    if (pose.cls) keeper.classList.add(pose.cls);
}

// ── Reset về trạng thái đứng giữa khung ──────────────────
export function resetKeeper() {
    keeper.classList.remove('diving');
    keeper.style.transition = 'none';
    keeper.style.left       = '50%';
    keeper.style.bottom     = '0%';
    keeper.style.transform  = 'translateX(-50%)';
    setKeeperPose('stand');

    requestAnimationFrame(() => {
        keeper.style.transition =
            'left 0.22s cubic-bezier(.34,1.56,.64,1), bottom 0.18s ease-out';
    });
}

// ── Di chuyển keeper đến zone ────────────────────────────
export function moveKeeperToZone(keeperZone, zonePos) {
    const kTarget = zonePos[keeperZone];
    keeper.classList.add('diving');
    keeper.style.left   = kTarget.l + '%';
    keeper.style.bottom = kTarget.b + '%';
    setKeeperPose(zoneToDiveDir(keeperZone));
}

// ── AI: bot thủ môn đoán zone ngẫu nhiên ─────────────────
export function botDecideKeeper() {
    return Math.floor(Math.random() * 9);
}

// ── Expose element để ball.js / game.js dùng ─────────────
export { keeper };
