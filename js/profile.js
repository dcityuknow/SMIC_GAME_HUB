/**
 * profile.js  –  SMIC GAME HUB
 * Identity  = địa chỉ ví
 * Score     = lưu onchain, user tự ký
 * Contract  : ScoreBoard trên Seismic Testnet
 */

const CONTRACT_ADDRESS = '0x8A58A4a8d801C35c7a3c08f521b023bB9a6132b4';
const RPC_URL          = 'https://testnet-2.seismictest.net/rpc';
const EXPLORER_URL     = 'https://seismic-testnet.socialscan.io';

// ── ABI selectors ─────────────────────────────────────────────
// setUsername(string)          → e47d6060 (sẽ tính đúng bên dưới)
// addScore(uint256)            → gọi với points=10
// getProfile(address)
// getLeaderboard(uint256)

function sel(sig) {
    // Tính 4-byte selector từ function signature (không dùng ethers)
    // Hardcode các selector đã tính sẵn:
    const map = {
        'setUsername(string)':    'c47f0027',
        'addScore(uint256)':      '9a3b9b4b',
        'getProfile(address)':    '08ae4b0c',
        'getLeaderboard(uint256)':'a8f3b7ae',
    };
    return map[sig] || '00000000';
}

// ── ABI encode helpers ────────────────────────────────────────
function encodeUint256(val) {
    return BigInt(val).toString(16).padStart(64, '0');
}
function encodeAddress(addr) {
    return addr.toLowerCase().replace('0x','').padStart(64,'0');
}
function encodeString(str) {
    const bytes  = new TextEncoder().encode(str);
    const len    = bytes.length;
    const offset = BigInt(32).toString(16).padStart(64,'0');
    const length = BigInt(len).toString(16).padStart(64,'0');
    let   hex    = '';
    for (const b of bytes) hex += b.toString(16).padStart(2,'0');
    return offset + length + hex.padEnd(Math.ceil(len/32)*64,'0');
}
function decodeStr(hex) {
    try {
        const h   = hex.replace('0x','');
        const off = parseInt(h.slice(0,64),16)*2;
        const len = parseInt(h.slice(off,off+64),16);
        const raw = h.slice(off+64, off+64+len*2);
        const arr = [];
        for (let i=0;i<raw.length;i+=2) arr.push(parseInt(raw.slice(i,i+2),16));
        return new TextDecoder().decode(new Uint8Array(arr));
    } catch { return ''; }
}
function shortenAddr(a) { return a ? a.slice(0,6)+'…'+a.slice(-4) : ''; }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

// ── eth_call (read) ───────────────────────────────────────────
async function ethCall(data) {
    const res = await fetch(RPC_URL, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_call',
            params:[{ to: CONTRACT_ADDRESS, data }, 'latest'] })
    });
    const j = await res.json();
    if (j.error) throw new Error(j.error.message);
    return j.result;
}

// ── eth_sendTransaction (write — user ký) ─────────────────────
async function sendTx(data, gasHex='0x30D40') {
    const provider = window.SmicWallet?._provider || window.ethereum;
    if (!provider) throw new Error('No wallet');
    const addr = window.SmicWallet?.getAddress();
    if (!addr)  throw new Error('Wallet not connected');
    const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: addr, to: CONTRACT_ADDRESS, data, gas: gasHex }]
    });
    return txHash;
}

async function waitReceipt(txHash, tries=40) {
    const provider = window.SmicWallet?._provider || window.ethereum;
    for (let i=0;i<tries;i++) {
        await sleep(800);
        try {
            const r = await provider.request({ method:'eth_getTransactionReceipt', params:[txHash] });
            if (r?.status) return r;
        } catch(_){}
    }
    return null;
}

// ── Contract calls ────────────────────────────────────────────
async function contract_getProfile(address) {
    try {
        const data   = '0x' + sel('getProfile(address)') + encodeAddress(address);
        const result = await ethCall(data);
        if (!result || result === '0x') return null;
        const h      = result.replace('0x','');
        // returns (string username, uint256 score, uint32 wins, bool exists)
        // slot0: offset of string
        // slot1: score
        // slot2: wins
        // slot3: exists
        const score  = parseInt(h.slice(64,128),16);
        const wins   = parseInt(h.slice(128,192),16);
        const exists = parseInt(h.slice(192,256),16) === 1;
        const username = decodeStr('0x'+h);
        return { username, score, wins, exists };
    } catch(e) { console.warn('getProfile error:',e); return null; }
}

async function contract_setUsername(username) {
    const data = '0x' + sel('setUsername(string)') + encodeString(username);
    return sendTx(data, '0x30D40');
}

async function contract_addScore(points) {
    const data = '0x' + sel('addScore(uint256)') + encodeUint256(points);
    return sendTx(data, '0x186A0');
}

async function contract_getLeaderboard(limit=10) {
    try {
        const data   = '0x' + sel('getLeaderboard(uint256)') + encodeUint256(limit);
        const result = await ethCall(data);
        if (!result || result === '0x') return [];
        const h = result.replace('0x','');

        // 4 dynamic arrays → 4 offsets at start (each 32 bytes)
        const off0 = parseInt(h.slice(0,64),16)*2;
        const off1 = parseInt(h.slice(64,128),16)*2;
        const off2 = parseInt(h.slice(128,192),16)*2;
        const off3 = parseInt(h.slice(192,256),16)*2;

        const readUintArr = (off) => {
            const len = parseInt(h.slice(off,off+64),16);
            const arr = [];
            for (let i=0;i<len;i++) arr.push(parseInt(h.slice(off+64+i*64,off+64+i*64+64),16));
            return arr;
        };
        const readAddrArr = (off) => {
            const len = parseInt(h.slice(off,off+64),16);
            const arr = [];
            for (let i=0;i<len;i++) arr.push('0x'+h.slice(off+64+i*64+24,off+64+i*64+64));
            return arr;
        };
        const readStrArr = (off) => {
            const len = parseInt(h.slice(off,off+64),16);
            const arr = [];
            for (let i=0;i<len;i++) {
                const strOff = parseInt(h.slice(off+64+i*64,off+64+i*64+64),16)*2;
                arr.push(decodeStr('0x'+h.slice(off+strOff)));
            }
            return arr;
        };

        const addrs     = readAddrArr(off0);
        const usernames = readStrArr(off1);
        const scores    = readUintArr(off2);
        const wins      = readUintArr(off3);

        return addrs.map((a,i) => ({
            address:  a,
            username: usernames[i] || shortenAddr(a),
            score:    scores[i]    || 0,
            wins:     wins[i]      || 0,
        }));
    } catch(e) { console.warn('getLeaderboard error:',e); return []; }
}

// ── Local cache (avatar + optimistic score) ───────────────────
const LC = {
    key: a => 'smicP_'+a.toLowerCase(),
    get: a => { try { return JSON.parse(localStorage.getItem(LC.key(a)))||{}; } catch { return {}; } },
    set: (a,d) => localStorage.setItem(LC.key(a), JSON.stringify({...LC.get(a),...d})),
};

// ── awardWin — gọi từ game pages sau khi thắng ───────────────
window.awardWin = async function() {
    const addr = window.SmicWallet?.getAddress();
    if (!addr) { showProfileToast('🔗 Connect wallet to save score!'); return; }

    const POINTS = 10;
    // Cập nhật local cache ngay để UI phản hồi nhanh
    const cached = LC.get(addr);
    LC.set(addr, { score:(cached.score||0)+POINTS, wins:(cached.wins||0)+1 });
    updateProfileWidget();

    showProfileToast('⏳ Saving score onchain...');
    try {
        const txHash = await contract_addScore(POINTS);
        showProfileToast('⏳ Confirming...');
        await waitReceipt(txHash);
        showProfileToast('🏆 +10 pts saved onchain!');
        // Sync từ chain về cache
        const fresh = await contract_getProfile(addr);
        if (fresh) LC.set(addr, { score: fresh.score, wins: fresh.wins });
        updateProfileWidget();
    } catch(e) {
        showProfileToast('⚠️ ' + (e.message?.slice(0,40) || 'TX failed'));
    }
};

// ── Profile Modal ─────────────────────────────────────────────
window.openProfileModal = async function() {
    document.getElementById('smicProfileModal')?.remove();
    const addr = window.SmicWallet?.getAddress();
    if (!addr) { showProfileToast('🔗 Connect your wallet first!'); return; }

    // Render ngay với cache
    renderProfileModal(addr, LC.get(addr), true);
    // Fetch onchain song song
    const chain = await contract_getProfile(addr);
    if (chain) {
        LC.set(addr, { username: chain.username, score: chain.score, wins: chain.wins });
        renderProfileModal(addr, LC.get(addr), false);
    }
};

function renderProfileModal(addr, data, loading) {
    document.getElementById('smicProfileModal')?.remove();
    const username = data.username || '';
    const score    = data.score    || 0;
    const wins     = data.wins     || 0;
    const avatar   = data.avatar   || null;
    const initials = username ? username[0].toUpperCase() : addr.slice(2,4).toUpperCase();

    const modal = document.createElement('div');
    modal.id = 'smicProfileModal';
    modal.innerHTML = `
    <div class="spm-backdrop"></div>
    <div class="spm-panel">
        <button class="spm-close" id="spmClose">✕</button>
        <div class="spm-header">
            <div class="spm-avatar-wrap">
                <div class="spm-avatar">
                    ${avatar ? `<img src="${avatar}" alt="av">` : `<span>${initials}</span>`}
                </div>
                <label class="spm-avatar-change" title="Change photo">
                    📷<input type="file" id="spmAvatarInput" accept="image/*" style="display:none">
                </label>
            </div>
            <div class="spm-info">
                <div class="spm-addr">${shortenAddr(addr)}</div>
                <div class="spm-score-row">
                    <span class="spm-badge">🏆 ${score} pts</span>
                    <span class="spm-badge">🎮 ${wins} wins</span>
                </div>
                <div class="spm-chain-badge">⚡ Seismic Testnet · SIZW</div>
            </div>
        </div>

        <div class="spm-section">
            <label class="spm-label">
                Username
                ${loading ? '<span class="spm-loading">syncing chain…</span>' : ''}
            </label>
            <div class="spm-edit-row">
                <input class="spm-input" id="spmUsernameInput" type="text"
                    value="${username}" placeholder="Set your username"
                    maxlength="24" ${loading?'disabled':''}>
                <button class="spm-save-btn" id="spmSaveBtn" ${loading?'disabled':''}>Save</button>
            </div>
            <div class="spm-hint">Saved onchain · you sign the transaction</div>
        </div>

        <a class="spm-explorer-link"
           href="${EXPLORER_URL}/address/${addr}" target="_blank">
            🔍 View on Explorer →
        </a>
    </div>`;
    document.body.appendChild(modal);

    modal.querySelector('.spm-backdrop').onclick = () => modal.remove();
    modal.querySelector('#spmClose').onclick     = () => modal.remove();

    // Avatar — lưu local (không lên chain)
    modal.querySelector('#spmAvatarInput').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            LC.set(addr, { avatar: ev.target.result });
            renderProfileModal(addr, LC.get(addr), false);
            updateProfileWidget();
        };
        reader.readAsDataURL(file);
    };

    // Save username onchain
    modal.querySelector('#spmSaveBtn').onclick = async () => {
        const val = modal.querySelector('#spmUsernameInput').value.trim();
        if (!val) return;
        const btn = modal.querySelector('#spmSaveBtn');
        btn.disabled = true; btn.textContent = '...';
        try {
            showProfileToast('⏳ Waiting for signature...');
            const tx = await contract_setUsername(val);
            showProfileToast('⏳ Confirming...');
            await waitReceipt(tx);
            LC.set(addr, { username: val });
            showProfileToast('✅ Username saved onchain!');
            updateProfileWidget();
            renderProfileModal(addr, LC.get(addr), false);
        } catch(e) {
            showProfileToast('❌ ' + (e.message?.slice(0,50)||'Failed'));
            btn.disabled = false; btn.textContent = 'Save';
        }
    };
}

// ── Leaderboard Modal ─────────────────────────────────────────
window.openLeaderboard = async function() {
    document.getElementById('smicLBModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'smicLBModal';
    modal.innerHTML = `
    <div class="spm-backdrop"></div>
    <div class="slb-panel">
        <button class="spm-close" id="slbClose">✕</button>
        <h2 class="slb-title">🏆 LEADERBOARD</h2>
        <div class="slb-chain-note">⚡ Live from Seismic Testnet · ${CONTRACT_ADDRESS.slice(0,10)}…</div>
        <div class="slb-list" id="slbList"><div class="slb-loading">Loading onchain data…</div></div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.spm-backdrop').onclick = () => modal.remove();
    modal.querySelector('#slbClose').onclick     = () => modal.remove();

    const myAddr  = window.SmicWallet?.getAddress()?.toLowerCase();
    const entries = await contract_getLeaderboard(10);
    const listEl  = modal.querySelector('#slbList');

    if (!entries.length) {
        listEl.innerHTML = `<div class="slb-empty">No scores yet — play a game!</div>`;
        return;
    }

    listEl.innerHTML = entries.map((e,i) => {
        const medal  = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`;
        const isMe   = myAddr && e.address.toLowerCase()===myAddr;
        const cached = LC.get(e.address);
        const av     = cached.avatar;
        const init   = e.username ? e.username[0].toUpperCase() : e.address.slice(2,4).toUpperCase();
        return `<div class="slb-row${isMe?' slb-me':''}">
            <span class="slb-rank">${medal}</span>
            <div class="slb-avatar">${av
                ? `<img src="${av}" class="slb-av-img" alt="av">`
                : `<span class="slb-av-letter">${init}</span>`}</div>
            <div class="slb-player">
                <div class="slb-name">${e.username||shortenAddr(e.address)}${isMe?' <span class="slb-you">YOU</span>':''}</div>
                <div class="slb-addr">${shortenAddr(e.address)}</div>
            </div>
            <div class="slb-pts">${e.score}<span> pts</span></div>
        </div>`;
    }).join('');
};

// ── Profile Widget (top-left, dưới faucet btn) ───────────────
function updateProfileWidget() {
    document.getElementById('smicProfileWidget')?.remove();
    const addr = window.SmicWallet?.getAddress();
    if (!addr) return;
    const cached   = LC.get(addr);
    const initials = cached.username ? cached.username[0].toUpperCase() : addr.slice(2,4).toUpperCase();
    const w = document.createElement('div');
    w.id = 'smicProfileWidget';
    w.innerHTML = `
        <button class="spw-btn" id="spwBtn" title="Profile">
            ${cached.avatar
                ? `<img src="${cached.avatar}" class="spw-av-img" alt="av">`
                : `<span class="spw-initials">${initials}</span>`}
        </button>
        <div class="spw-score">${cached.score||0} pts</div>`;
    document.body.appendChild(w);
    w.querySelector('#spwBtn').onclick = () => window.openProfileModal();
}
window.updateProfileWidget = updateProfileWidget;

// ── Leaderboard Button (lobby only) ──────────────────────────
function initLeaderboardBtn() {
    document.getElementById('smicLBBtn')?.remove();
    const btn = document.createElement('button');
    btn.id = 'smicLBBtn';
    btn.innerHTML = '🏆 LEADERBOARD';
    btn.onclick = () => window.openLeaderboard();
    document.body.appendChild(btn);
}

// ── Toast ─────────────────────────────────────────────────────
function showProfileToast(msg) {
    let t = document.getElementById('smicProfileToast');
    if (!t) { t = document.createElement('div'); t.id='smicProfileToast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('spt-show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('spt-show'), 3500);
}
window.showProfileToast = showProfileToast;

// ── Styles ────────────────────────────────────────────────────
(function(){
    const s = document.createElement('style');
    s.textContent = `
    #smicProfileWidget {
        position:fixed; top:68px; left:16px; z-index:500;
        display:flex; flex-direction:column; align-items:center; gap:4px;
    }
    .spw-btn {
        width:44px; height:44px; border-radius:50%;
        border:2px solid rgba(255,215,0,0.45);
        background:rgba(0,0,0,0.6); backdrop-filter:blur(8px);
        cursor:pointer; display:flex; align-items:center; justify-content:center;
        padding:0; overflow:hidden; transition:border-color 0.2s,transform 0.15s;
    }
    .spw-btn:hover { border-color:#ffd700; transform:scale(1.08); }
    .spw-av-img { width:100%;height:100%;object-fit:cover; }
    .spw-initials { font-size:1rem;font-weight:900;color:#ffd700; }
    .spw-score { font-size:0.62rem;font-weight:900;color:#ffd700;letter-spacing:1px;text-shadow:0 1px 4px rgba(0,0,0,0.8); }

    #smicLBBtn {
        position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
        z-index:500; padding:10px 28px;
        font-family:'Bangers',cursive; font-size:1.1rem; letter-spacing:3px;
        color:#ffd700; background:rgba(0,0,0,0.6);
        border:2px solid rgba(255,215,0,0.35); border-radius:40px;
        cursor:pointer; backdrop-filter:blur(8px);
        transition:background 0.2s,border-color 0.2s,transform 0.15s;
    }
    #smicLBBtn:hover { background:rgba(255,215,0,0.12);border-color:#ffd700;transform:translateX(-50%) scale(1.04); }

    #smicProfileModal,#smicLBModal {
        position:fixed;inset:0;z-index:9000;
        display:flex;align-items:center;justify-content:center;
    }
    .spm-backdrop { position:absolute;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px); }
    @keyframes spmIn { from{opacity:0;transform:scale(0.9) translateY(14px)} to{opacity:1;transform:scale(1) translateY(0)} }

    .spm-panel {
        position:relative;z-index:1;background:#0f1322;
        border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:28px 24px;
        width:min(420px,92vw);display:flex;flex-direction:column;gap:18px;
        box-shadow:0 32px 80px rgba(0,0,0,0.85);
        animation:spmIn 0.22s cubic-bezier(.34,1.56,.64,1);
    }
    .spm-close {
        position:absolute;top:14px;right:14px;
        background:rgba(255,255,255,0.07);border:none;
        color:rgba(255,255,255,0.45);border-radius:50%;
        width:28px;height:28px;cursor:pointer;font-size:0.8rem;transition:background 0.2s;
    }
    .spm-close:hover { background:rgba(255,255,255,0.15);color:#fff; }
    .spm-header { display:flex;gap:14px;align-items:center; }
    .spm-avatar-wrap { position:relative;flex-shrink:0; }
    .spm-avatar {
        width:68px;height:68px;border-radius:50%;
        border:3px solid rgba(255,215,0,0.35);
        background:linear-gradient(135deg,#1a1f38,#252c4a);
        display:flex;align-items:center;justify-content:center;
        overflow:hidden;font-size:1.6rem;font-weight:900;color:#ffd700;
    }
    .spm-avatar img { width:100%;height:100%;object-fit:cover; }
    .spm-avatar-change {
        position:absolute;bottom:-3px;right:-3px;
        background:#ffd700;border-radius:50%;width:22px;height:22px;
        display:flex;align-items:center;justify-content:center;
        font-size:0.7rem;cursor:pointer;border:2px solid #0f1322;
    }
    .spm-info { flex:1;min-width:0; }
    .spm-addr { font-size:0.78rem;color:rgba(255,255,255,0.4);font-family:monospace;margin-bottom:6px; }
    .spm-score-row { display:flex;gap:8px;flex-wrap:wrap; }
    .spm-badge {
        font-size:0.75rem;font-weight:800;padding:3px 10px;border-radius:20px;
        background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.2);color:#ffd700;
    }
    .spm-chain-badge { font-size:0.68rem;color:rgba(93,235,138,0.7);margin-top:5px;font-weight:700;letter-spacing:0.5px; }
    .spm-section { display:flex;flex-direction:column;gap:7px; }
    .spm-label { font-size:0.7rem;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:1px;text-transform:uppercase; }
    .spm-loading { color:rgba(255,215,0,0.5);font-size:0.7rem;font-style:italic;margin-left:6px; }
    .spm-edit-row { display:flex;gap:8px; }
    .spm-input {
        flex:1;padding:9px 12px;border-radius:10px;
        border:1px solid rgba(255,255,255,0.12);
        background:rgba(255,255,255,0.06);color:#fff;font-size:0.9rem;outline:none;
    }
    .spm-input:focus { border-color:#ffd700; }
    .spm-save-btn {
        padding:9px 16px;border-radius:10px;border:none;
        background:#ffd700;color:#000;font-weight:900;font-size:0.85rem;
        cursor:pointer;transition:background 0.2s;
    }
    .spm-save-btn:hover:not(:disabled) { background:#f0c800; }
    .spm-save-btn:disabled { opacity:0.5;cursor:wait; }
    .spm-hint { font-size:0.68rem;color:rgba(255,255,255,0.25); }
    .spm-explorer-link {
        font-size:0.78rem;color:rgba(93,235,138,0.7);text-decoration:none;font-weight:700;
        text-align:center;padding:8px;border:1px solid rgba(93,235,138,0.15);border-radius:10px;
        transition:background 0.2s;
    }
    .spm-explorer-link:hover { background:rgba(93,235,138,0.07); }

    .slb-panel {
        position:relative;z-index:1;background:#0f1322;
        border:1px solid rgba(255,215,0,0.12);border-radius:24px;padding:26px 22px;
        width:min(460px,94vw);max-height:88vh;
        display:flex;flex-direction:column;gap:14px;
        box-shadow:0 32px 80px rgba(0,0,0,0.9);
        animation:spmIn 0.22s cubic-bezier(.34,1.56,.64,1);overflow:hidden;
    }
    .slb-title {
        font-family:'Bangers',cursive;font-size:2rem;letter-spacing:4px;
        color:#ffd700;text-align:center;margin:0;text-shadow:0 0 20px rgba(255,215,0,0.35);
    }
    .slb-chain-note { font-size:0.68rem;color:rgba(93,235,138,0.55);text-align:center;font-weight:700;letter-spacing:0.5px; }
    .slb-list { display:flex;flex-direction:column;gap:7px;overflow-y:auto;max-height:400px;padding-right:4px; }
    .slb-list::-webkit-scrollbar { width:3px; }
    .slb-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1);border-radius:2px; }
    .slb-loading,.slb-empty { text-align:center;color:rgba(255,255,255,0.3);padding:24px;font-size:0.85rem; }
    .slb-row {
        display:flex;align-items:center;gap:11px;
        background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);
        border-radius:12px;padding:10px 13px;
    }
    .slb-row.slb-me { background:rgba(255,215,0,0.07);border-color:rgba(255,215,0,0.2); }
    .slb-rank { font-size:1.05rem;width:26px;text-align:center;flex-shrink:0; }
    .slb-avatar {
        width:34px;height:34px;border-radius:50%;overflow:hidden;flex-shrink:0;
        background:linear-gradient(135deg,#252c4a,#1a1f38);
        display:flex;align-items:center;justify-content:center;
        border:2px solid rgba(255,255,255,0.08);
    }
    .slb-av-img { width:100%;height:100%;object-fit:cover; }
    .slb-av-letter { font-size:0.9rem;font-weight:900;color:#ffd700; }
    .slb-player { flex:1;min-width:0; }
    .slb-name { font-size:0.88rem;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .slb-addr { font-size:0.68rem;color:rgba(255,255,255,0.3);font-family:monospace; }
    .slb-you { font-size:0.58rem;background:#ffd700;color:#000;border-radius:4px;padding:1px 5px;font-weight:900;margin-left:4px;vertical-align:middle; }
    .slb-pts { font-size:1.05rem;font-weight:900;color:#ffd700;flex-shrink:0; }
    .slb-pts span { font-size:0.68rem;opacity:0.5; }

    #smicProfileToast {
        position:fixed;bottom:72px;left:50%;transform:translateX(-50%) translateY(10px);
        background:rgba(15,19,34,0.95);border:1px solid rgba(255,255,255,0.1);
        color:#fff;font-size:0.83rem;font-weight:700;
        padding:9px 18px;border-radius:40px;opacity:0;pointer-events:none;
        transition:opacity 0.22s,transform 0.22s;z-index:9999;white-space:nowrap;
        backdrop-filter:blur(8px);font-family:'Nunito',sans-serif;
    }
    #smicProfileToast.spt-show { opacity:1;transform:translateX(-50%) translateY(0); }
    `;
    document.head.appendChild(s);
})();

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Poll cho đến khi wallet.js connect xong
    const poll = setInterval(() => {
        const addr = window.SmicWallet?.getAddress?.();
        if (addr) { clearInterval(poll); updateProfileWidget(); }
    }, 400);

    // Lobby → thêm leaderboard button
    if (document.querySelector('.game-grid')) initLeaderboardBtn();
});

// wallet.js gọi callback này sau khi connect/disconnect
window.__smicWalletChanged = (addr) => {
    if (addr) updateProfileWidget();
    else document.getElementById('smicProfileWidget')?.remove();
};
