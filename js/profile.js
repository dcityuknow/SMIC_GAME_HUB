/**
 * profile.js  –  SMIC GAME HUB
 * Identity = địa chỉ ví (không cần Gmail)
 * Username + score lưu onchain qua ScoreBoard contract
 *
 * SAU KHI DEPLOY CONTRACT → thay CONTRACT_ADDRESS bên dưới
 */

// ── CONFIG (cập nhật sau khi deploy) ─────────────────────────
const CONTRACT_ADDRESS = 'PASTE_CONTRACT_ADDRESS_HERE';

// ABI chỉ những function cần dùng
const CONTRACT_ABI = [
    // setUsername(string)
    '0x' + 'c47f0027', // selector placeholder — dùng encodeSetUsername()
    // getProfile(address) → (string,uint256,uint32,bool)
    // getLeaderboard(uint256) → (address[],string[],uint256[],uint32[])
    // addScore(address,uint256) — owner only
];

// ── ABI encode helpers (không cần ethers.js) ─────────────────

function encodeSetUsername(username) {
    // setUsername(string) selector = keccak256 đầu 4 bytes
    const selector = 'c47f0027';
    const encoded  = encodeABIString(username);
    return '0x' + selector + encoded;
}

function encodeGetProfile(address) {
    // getProfile(address) selector
    const selector = '08ae4b0c';
    const padded   = address.toLowerCase().replace('0x','').padStart(64,'0');
    return '0x' + selector + padded;
}

function encodeGetLeaderboard(limit) {
    // getLeaderboard(uint256) selector
    const selector = 'a8f3b7ae';
    const padded   = BigInt(limit).toString(16).padStart(64,'0');
    return '0x' + selector + padded;
}

function encodeAddScore(playerAddress, points) {
    // addScore(address,uint256) selector
    const selector  = '6b0083e8';
    const paddedAddr = playerAddress.toLowerCase().replace('0x','').padStart(64,'0');
    const paddedPts  = BigInt(points).toString(16).padStart(64,'0');
    return '0x' + selector + paddedAddr + paddedPts;
}

function encodeABIString(str) {
    // ABI encode: offset(32) + length(32) + data(padded 32)
    const bytes  = new TextEncoder().encode(str);
    const len    = bytes.length;
    const offset = BigInt(32).toString(16).padStart(64,'0');
    const length = BigInt(len).toString(16).padStart(64,'0');
    let   hex    = '';
    for (const b of bytes) hex += b.toString(16).padStart(2,'0');
    const padded = hex.padEnd(Math.ceil(len/32)*64, '0');
    return offset + length + padded;
}

function decodeString(hex) {
    // ABI decode string từ eth_call result
    try {
        const clean  = hex.replace('0x','');
        const offset = parseInt(clean.slice(0,64), 16) * 2;
        const len    = parseInt(clean.slice(offset, offset+64), 16);
        const data   = clean.slice(offset+64, offset+64+len*2);
        const bytes  = [];
        for (let i=0;i<data.length;i+=2) bytes.push(parseInt(data.slice(i,i+2),16));
        return new TextDecoder().decode(new Uint8Array(bytes));
    } catch { return ''; }
}

// ── RPC call helper ───────────────────────────────────────────
async function rpcCall(data, to) {
    const res = await fetch('https://testnet-2.seismictest.net/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to: to || CONTRACT_ADDRESS, data }, 'latest']
        })
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
}

// ── Contract interactions ─────────────────────────────────────

async function fetchProfileFromChain(address) {
    if (!address || CONTRACT_ADDRESS === 'PASTE_CONTRACT_ADDRESS_HERE') return null;
    try {
        const result = await rpcCall(encodeGetProfile(address));
        if (!result || result === '0x') return null;
        const clean   = result.replace('0x','');
        // (string username, uint256 score, uint32 wins, bool exists)
        // string is dynamic → offset at slot 0
        const score   = parseInt(clean.slice(64,128), 16);
        const wins    = parseInt(clean.slice(128,192), 16);
        const exists  = parseInt(clean.slice(192,256), 16) === 1;
        const username = decodeString('0x' + clean);
        return { username, score, wins, exists };
    } catch(e) {
        console.warn('fetchProfileFromChain error:', e);
        return null;
    }
}

async function fetchLeaderboardFromChain(limit = 10) {
    if (CONTRACT_ADDRESS === 'PASTE_CONTRACT_ADDRESS_HERE') return [];
    try {
        const result = await rpcCall(encodeGetLeaderboard(limit));
        if (!result || result === '0x') return [];
        // Decode 4 dynamic arrays: address[], string[], uint256[], uint32[]
        const clean = result.replace('0x','');
        // Đọc offsets (4 × 32 bytes)
        const off0 = parseInt(clean.slice(0,64),16)*2;
        const off1 = parseInt(clean.slice(64,128),16)*2;
        const off2 = parseInt(clean.slice(128,192),16)*2;
        const off3 = parseInt(clean.slice(192,256),16)*2;

        const readArray = (off, type) => {
            const len = parseInt(clean.slice(off, off+64),16);
            const items = [];
            for (let i=0; i<len; i++) {
                const slot = clean.slice(off+64+i*64, off+64+i*64+64);
                if (type === 'address') items.push('0x'+slot.slice(24));
                else if (type === 'uint') items.push(parseInt(slot,16));
            }
            return items;
        };

        const readStringArray = (off) => {
            const len = parseInt(clean.slice(off, off+64),16);
            const offsets = [];
            for (let i=0;i<len;i++) offsets.push(parseInt(clean.slice(off+64+i*64,off+64+i*64+64),16)*2);
            return offsets.map(o => decodeString('0x'+clean.slice(off+o)));
        };

        const addrs     = readArray(off0, 'address');
        const usernames = readStringArray(off1);
        const scores    = readArray(off2, 'uint');
        const winsArr   = readArray(off3, 'uint');

        return addrs.map((a,i) => ({
            address:  a,
            username: usernames[i] || shortenAddr(a),
            score:    scores[i]    || 0,
            wins:     winsArr[i]   || 0,
        }));
    } catch(e) {
        console.warn('fetchLeaderboardFromChain error:', e);
        return [];
    }
}

async function setUsernameOnChain(username) {
    const provider = activeProvider || window.ethereum;
    if (!provider || !walletAddress) throw new Error('Wallet not connected');
    if (CONTRACT_ADDRESS === 'PASTE_CONTRACT_ADDRESS_HERE') throw new Error('Contract not deployed yet');

    const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: walletAddress, to: CONTRACT_ADDRESS, data: encodeSetUsername(username), gas: '0x186A0' }]
    });
    showProfileToast('⏳ Waiting for confirmation...');
    await waitTx(txHash);
    showProfileToast('✅ Username saved onchain!');
    return txHash;
}

async function addScoreOnChain(playerAddress, points) {
    // Gọi bởi owner wallet — trong frontend: owner tự gọi khi game kết thúc
    const provider = activeProvider || window.ethereum;
    if (!provider || !walletAddress) return;
    if (CONTRACT_ADDRESS === 'PASTE_CONTRACT_ADDRESS_HERE') {
        // Fallback: lưu localStorage khi chưa deploy
        const cached = JSON.parse(localStorage.getItem('smicScoreCache')||'{}');
        cached[playerAddress] = { score: (cached[playerAddress]?.score||0)+points, wins: (cached[playerAddress]?.wins||0)+1 };
        localStorage.setItem('smicScoreCache', JSON.stringify(cached));
        return;
    }
    try {
        const txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [{ from: walletAddress, to: CONTRACT_ADDRESS, data: encodeAddScore(playerAddress, points), gas: '0x30D40' }]
        });
        await waitTx(txHash);
        showProfileToast('🏆 +' + points + ' pts saved onchain!');
    } catch(e) {
        console.warn('addScoreOnChain error:', e.message);
        showProfileToast('⚠️ Score TX failed — saved locally');
    }
}

async function waitTx(txHash, maxTries=30) {
    const provider = activeProvider || window.ethereum;
    for (let i=0;i<maxTries;i++) {
        await sleep(1000);
        try {
            const r = await provider.request({ method:'eth_getTransactionReceipt', params:[txHash] });
            if (r && r.status) return r;
        } catch(_) {}
    }
}
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
function shortenAddr(a) { return a ? a.slice(0,6)+'…'+a.slice(-4) : ''; }

// ── Local cache (username + cached score khi offline) ─────────
const LocalProfile = {
    KEY: addr => 'smicP_'+addr.toLowerCase(),
    get: addr => { try { return JSON.parse(localStorage.getItem(LocalProfile.KEY(addr))); } catch { return null; } },
    set: (addr, data) => localStorage.setItem(LocalProfile.KEY(addr), JSON.stringify({ ...LocalProfile.get(addr), ...data })),
};

// ── awardWin — gọi từ game pages ─────────────────────────────
async function awardWin() {
    if (!walletAddress) return;
    const POINTS = 10;
    // Lưu local trước để UI phản hồi nhanh
    const cached = LocalProfile.get(walletAddress) || {};
    LocalProfile.set(walletAddress, { score: (cached.score||0)+POINTS, wins: (cached.wins||0)+1 });
    updateProfileWidget();
    // Gửi onchain
    await addScoreOnChain(walletAddress, POINTS);
}
window.awardWin = awardWin;

// ── Profile Modal ─────────────────────────────────────────────
async function openProfileModal() {
    document.getElementById('smicProfileModal')?.remove();

    if (!walletAddress) {
        showProfileToast('🔗 Connect your wallet first!');
        return;
    }

    // Hiện modal ngay với cached data, load onchain song song
    const cached = LocalProfile.get(walletAddress) || {};
    renderProfileModal(cached, true);

    // Load onchain
    const chain = await fetchProfileFromChain(walletAddress);
    if (chain) {
        LocalProfile.set(walletAddress, { username: chain.username, score: chain.score, wins: chain.wins });
        renderProfileModal({ username: chain.username, score: chain.score, wins: chain.wins }, false);
    }
}

function renderProfileModal(data, loading) {
    document.getElementById('smicProfileModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'smicProfileModal';

    const username = data.username || '';
    const score    = data.score    || 0;
    const wins     = data.wins     || 0;
    const initials = username ? username[0].toUpperCase() : walletAddress.slice(2,4).toUpperCase();
    const cached   = LocalProfile.get(walletAddress) || {};
    const avatar   = cached.avatar || null;

    modal.innerHTML = `
    <div class="spm-backdrop"></div>
    <div class="spm-panel">
        <button class="spm-close" id="spmClose">✕</button>

        <div class="spm-header">
            <div class="spm-avatar-wrap">
                <div class="spm-avatar" id="spmAvatar">
                    ${avatar ? `<img src="${avatar}" alt="av">` : `<span>${initials}</span>`}
                </div>
                <label class="spm-avatar-change" title="Change photo">
                    📷<input type="file" id="spmAvatarInput" accept="image/*" style="display:none">
                </label>
            </div>
            <div class="spm-info">
                <div class="spm-addr">${shortenAddr(walletAddress)}</div>
                <div class="spm-score-row">
                    <span class="spm-badge">🏆 ${score} pts</span>
                    <span class="spm-badge">🎮 ${wins} wins</span>
                </div>
                <div class="spm-chain-badge">⚡ Seismic Testnet</div>
            </div>
        </div>

        <div class="spm-section">
            <label class="spm-label">Username ${loading?'<span class="spm-loading">loading…</span>':''}</label>
            <div class="spm-edit-row">
                <input class="spm-input" id="spmUsernameInput" type="text"
                    value="${username}" placeholder="Set your username" maxlength="24" ${loading?'disabled':''}>
                <button class="spm-save-btn" id="spmSaveBtn" ${loading?'disabled':''}>Save</button>
            </div>
            <div class="spm-hint">Saved onchain · costs a tiny bit of gas</div>
        </div>

        <a class="spm-explorer-link" href="https://seismic-testnet.socialscan.io/address/${walletAddress}" target="_blank">
            🔍 View on Explorer →
        </a>
    </div>`;
    document.body.appendChild(modal);

    modal.querySelector('.spm-backdrop').onclick = () => modal.remove();
    modal.querySelector('#spmClose').onclick = () => modal.remove();

    // Avatar upload (local only)
    modal.querySelector('#spmAvatarInput').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            LocalProfile.set(walletAddress, { avatar: ev.target.result });
            renderProfileModal(data, false);
            updateProfileWidget();
        };
        reader.readAsDataURL(file);
    };

    // Save username onchain
    modal.querySelector('#spmSaveBtn').onclick = async () => {
        const val = modal.querySelector('#spmUsernameInput').value.trim();
        if (!val) return;
        modal.querySelector('#spmSaveBtn').disabled = true;
        modal.querySelector('#spmSaveBtn').textContent = '...';
        try {
            await setUsernameOnChain(val);
            LocalProfile.set(walletAddress, { username: val });
            updateProfileWidget();
            renderProfileModal({ ...data, username: val }, false);
        } catch(e) {
            showProfileToast('❌ ' + (e.message || 'TX failed'));
            modal.querySelector('#spmSaveBtn').disabled = false;
            modal.querySelector('#spmSaveBtn').textContent = 'Save';
        }
    };
}

// ── Leaderboard Modal ─────────────────────────────────────────
async function openLeaderboard() {
    document.getElementById('smicLBModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'smicLBModal';
    modal.innerHTML = `
    <div class="spm-backdrop"></div>
    <div class="slb-panel">
        <button class="spm-close" id="slbClose">✕</button>
        <h2 class="slb-title">🏆 LEADERBOARD</h2>
        <div class="slb-chain-note">⚡ Live from Seismic Testnet</div>
        <div class="slb-list" id="slbList">
            <div class="slb-loading">Loading onchain data…</div>
        </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.spm-backdrop').onclick = () => modal.remove();
    modal.querySelector('#slbClose').onclick = () => modal.remove();

    // Load leaderboard
    const entries = await fetchLeaderboardFromChain(10);

    // Merge với local cache khi contract chưa deploy
    let display = entries;
    if (display.length === 0) {
        const cache = JSON.parse(localStorage.getItem('smicScoreCache')||'{}');
        display = Object.entries(cache).map(([addr, d]) => ({
            address:  addr,
            username: LocalProfile.get(addr)?.username || shortenAddr(addr),
            score:    d.score||0,
            wins:     d.wins||0,
        })).sort((a,b)=>b.score-a.score).slice(0,10);
    }

    const listEl = modal.querySelector('#slbList');
    if (display.length === 0) {
        listEl.innerHTML = `<div class="slb-empty">No scores yet — play a game!</div>`;
        return;
    }

    listEl.innerHTML = display.map((e,i) => {
        const medal    = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`;
        const isMe     = walletAddress && e.address.toLowerCase() === walletAddress.toLowerCase();
        const av       = LocalProfile.get(e.address)?.avatar;
        const initials = e.username ? e.username[0].toUpperCase() : e.address.slice(2,4).toUpperCase();
        const avatarHtml = av ? `<img src="${av}" alt="av" class="slb-av-img">` : `<span class="slb-av-letter">${initials}</span>`;
        return `<div class="slb-row ${isMe?'slb-me':''}">
            <span class="slb-rank">${medal}</span>
            <div class="slb-avatar">${avatarHtml}</div>
            <div class="slb-player">
                <div class="slb-name">${e.username||shortenAddr(e.address)}${isMe?' <span class="slb-you">YOU</span>':''}</div>
                <div class="slb-addr">${shortenAddr(e.address)}</div>
            </div>
            <div class="slb-pts">${e.score}<span> pts</span></div>
        </div>`;
    }).join('');
}

// ── Profile Widget ────────────────────────────────────────────
function updateProfileWidget() {
    document.getElementById('smicProfileWidget')?.remove();
    if (!walletAddress) return;

    const cached   = LocalProfile.get(walletAddress) || {};
    const initials = cached.username ? cached.username[0].toUpperCase() : walletAddress.slice(2,4).toUpperCase();
    const avatar   = cached.avatar;

    const widget = document.createElement('div');
    widget.id = 'smicProfileWidget';
    widget.innerHTML = `
        <button class="spw-btn" id="spwBtn" title="Profile">
            ${avatar ? `<img src="${avatar}" alt="av" class="spw-av-img">` : `<span class="spw-initials">${initials}</span>`}
        </button>
        <div class="spw-score">${cached.score||0} pts</div>`;
    document.body.appendChild(widget);
    widget.querySelector('#spwBtn').onclick = openProfileModal;
}

// ── Leaderboard Button ────────────────────────────────────────
function initLeaderboardBtn() {
    document.getElementById('smicLBBtn')?.remove();
    const btn = document.createElement('button');
    btn.id = 'smicLBBtn';
    btn.innerHTML = '🏆 LEADERBOARD';
    btn.onclick = openLeaderboard;
    document.body.appendChild(btn);
}

// ── Toast ─────────────────────────────────────────────────────
function showProfileToast(msg) {
    let t = document.getElementById('smicProfileToast');
    if (!t) { t = document.createElement('div'); t.id = 'smicProfileToast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('spt-show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('spt-show'), 3000);
}

// ── Styles ────────────────────────────────────────────────────
(function() {
    const s = document.createElement('style');
    s.textContent = `
    /* Profile Widget */
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
    .spw-av-img { width:100%; height:100%; object-fit:cover; }
    .spw-initials { font-size:1rem; font-weight:900; color:#ffd700; }
    .spw-score { font-size:0.62rem; font-weight:900; color:#ffd700; letter-spacing:1px; text-shadow:0 1px 4px rgba(0,0,0,0.8); }

    /* Leaderboard btn */
    #smicLBBtn {
        position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
        z-index:500; padding:10px 28px;
        font-family:'Bangers',cursive; font-size:1.1rem; letter-spacing:3px;
        color:#ffd700; background:rgba(0,0,0,0.6);
        border:2px solid rgba(255,215,0,0.35); border-radius:40px;
        cursor:pointer; backdrop-filter:blur(8px);
        transition:background 0.2s,border-color 0.2s,transform 0.15s;
        box-shadow:0 0 20px rgba(255,215,0,0.1);
    }
    #smicLBBtn:hover { background:rgba(255,215,0,0.12); border-color:#ffd700; transform:translateX(-50%) scale(1.04); }

    /* Shared modal base */
    #smicProfileModal, #smicLBModal {
        position:fixed; inset:0; z-index:9000;
        display:flex; align-items:center; justify-content:center;
    }
    .spm-backdrop {
        position:absolute; inset:0;
        background:rgba(0,0,0,0.75); backdrop-filter:blur(6px);
    }
    @keyframes spmIn { from{opacity:0;transform:scale(0.9) translateY(14px)} to{opacity:1;transform:scale(1) translateY(0)} }

    /* Profile Panel */
    .spm-panel {
        position:relative; z-index:1;
        background:#0f1322; border:1px solid rgba(255,255,255,0.1);
        border-radius:24px; padding:28px 24px;
        width:min(420px,92vw); display:flex; flex-direction:column; gap:18px;
        box-shadow:0 32px 80px rgba(0,0,0,0.85);
        animation:spmIn 0.22s cubic-bezier(.34,1.56,.64,1);
    }
    .spm-close {
        position:absolute; top:14px; right:14px;
        background:rgba(255,255,255,0.07); border:none;
        color:rgba(255,255,255,0.45); border-radius:50%;
        width:28px; height:28px; cursor:pointer; font-size:0.8rem;
        transition:background 0.2s;
    }
    .spm-close:hover { background:rgba(255,255,255,0.15); color:#fff; }
    .spm-header { display:flex; gap:14px; align-items:center; }
    .spm-avatar-wrap { position:relative; flex-shrink:0; }
    .spm-avatar {
        width:68px; height:68px; border-radius:50%;
        border:3px solid rgba(255,215,0,0.35);
        background:linear-gradient(135deg,#1a1f38,#252c4a);
        display:flex; align-items:center; justify-content:center;
        overflow:hidden; font-size:1.6rem; font-weight:900; color:#ffd700;
    }
    .spm-avatar img { width:100%; height:100%; object-fit:cover; }
    .spm-avatar-change {
        position:absolute; bottom:-3px; right:-3px;
        background:#ffd700; border-radius:50%; width:22px; height:22px;
        display:flex; align-items:center; justify-content:center;
        font-size:0.7rem; cursor:pointer; border:2px solid #0f1322;
    }
    .spm-info { flex:1; min-width:0; }
    .spm-addr { font-size:0.78rem; color:rgba(255,255,255,0.45); font-family:monospace; margin-bottom:6px; }
    .spm-score-row { display:flex; gap:8px; flex-wrap:wrap; }
    .spm-badge {
        font-size:0.75rem; font-weight:800; padding:3px 10px;
        border-radius:20px; background:rgba(255,215,0,0.1);
        border:1px solid rgba(255,215,0,0.2); color:#ffd700;
    }
    .spm-chain-badge {
        font-size:0.68rem; color:rgba(93,235,138,0.7); margin-top:5px;
        font-weight:700; letter-spacing:0.5px;
    }
    .spm-section { display:flex; flex-direction:column; gap:7px; }
    .spm-label { font-size:0.7rem; font-weight:700; color:rgba(255,255,255,0.4); letter-spacing:1px; text-transform:uppercase; }
    .spm-loading { color:rgba(255,215,0,0.5); font-size:0.7rem; font-style:italic; margin-left:6px; }
    .spm-edit-row { display:flex; gap:8px; }
    .spm-input {
        flex:1; padding:9px 12px; border-radius:10px;
        border:1px solid rgba(255,255,255,0.12);
        background:rgba(255,255,255,0.06); color:#fff; font-size:0.9rem; outline:none;
    }
    .spm-input:focus { border-color:#ffd700; }
    .spm-save-btn {
        padding:9px 16px; border-radius:10px; border:none;
        background:#ffd700; color:#000; font-weight:900; font-size:0.85rem;
        cursor:pointer; transition:background 0.2s;
    }
    .spm-save-btn:hover:not(:disabled) { background:#f0c800; }
    .spm-save-btn:disabled { opacity:0.5; cursor:wait; }
    .spm-hint { font-size:0.68rem; color:rgba(255,255,255,0.25); }
    .spm-explorer-link {
        font-size:0.78rem; color:rgba(93,235,138,0.7); text-decoration:none;
        font-weight:700; text-align:center; padding:8px;
        border:1px solid rgba(93,235,138,0.15); border-radius:10px;
        transition:background 0.2s;
    }
    .spm-explorer-link:hover { background:rgba(93,235,138,0.07); }

    /* Leaderboard Panel */
    .slb-panel {
        position:relative; z-index:1;
        background:#0f1322; border:1px solid rgba(255,215,0,0.12);
        border-radius:24px; padding:26px 22px;
        width:min(460px,94vw); max-height:88vh;
        display:flex; flex-direction:column; gap:14px;
        box-shadow:0 32px 80px rgba(0,0,0,0.9);
        animation:spmIn 0.22s cubic-bezier(.34,1.56,.64,1);
        overflow:hidden;
    }
    .slb-title {
        font-family:'Bangers',cursive; font-size:2rem; letter-spacing:4px;
        color:#ffd700; text-align:center; margin:0;
        text-shadow:0 0 20px rgba(255,215,0,0.35);
    }
    .slb-chain-note {
        font-size:0.72rem; color:rgba(93,235,138,0.6); text-align:center;
        font-weight:700; letter-spacing:1px;
    }
    .slb-list { display:flex; flex-direction:column; gap:7px; overflow-y:auto; max-height:400px; padding-right:4px; }
    .slb-list::-webkit-scrollbar { width:3px; }
    .slb-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
    .slb-loading,.slb-empty { text-align:center; color:rgba(255,255,255,0.3); padding:24px; font-size:0.85rem; }
    .slb-row {
        display:flex; align-items:center; gap:11px;
        background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);
        border-radius:12px; padding:10px 13px; transition:background 0.15s;
    }
    .slb-row.slb-me { background:rgba(255,215,0,0.07); border-color:rgba(255,215,0,0.18); }
    .slb-rank { font-size:1.05rem; width:26px; text-align:center; flex-shrink:0; }
    .slb-avatar {
        width:34px; height:34px; border-radius:50%; overflow:hidden; flex-shrink:0;
        background:linear-gradient(135deg,#252c4a,#1a1f38);
        display:flex; align-items:center; justify-content:center;
        border:2px solid rgba(255,255,255,0.08);
    }
    .slb-av-img { width:100%; height:100%; object-fit:cover; }
    .slb-av-letter { font-size:0.9rem; font-weight:900; color:#ffd700; }
    .slb-player { flex:1; min-width:0; }
    .slb-name { font-size:0.88rem; font-weight:800; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .slb-addr { font-size:0.68rem; color:rgba(255,255,255,0.3); font-family:monospace; }
    .slb-you { font-size:0.58rem; background:#ffd700; color:#000; border-radius:4px; padding:1px 5px; font-weight:900; margin-left:4px; vertical-align:middle; }
    .slb-pts { font-size:1.05rem; font-weight:900; color:#ffd700; flex-shrink:0; }
    .slb-pts span { font-size:0.68rem; opacity:0.5; }

    /* Toast */
    #smicProfileToast {
        position:fixed; bottom:72px; left:50%; transform:translateX(-50%) translateY(10px);
        background:rgba(15,19,34,0.95); border:1px solid rgba(255,255,255,0.1);
        color:#fff; font-size:0.83rem; font-weight:700;
        padding:9px 18px; border-radius:40px; opacity:0; pointer-events:none;
        transition:opacity 0.22s,transform 0.22s; z-index:9999; white-space:nowrap;
        backdrop-filter:blur(8px); font-family:'Nunito',sans-serif;
    }
    #smicProfileToast.spt-show { opacity:1; transform:translateX(-50%) translateY(0); }
    `;
    document.head.appendChild(s);
})();

// ── Init & wallet watch ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Watch for wallet connection from wallet.js
    const checkWallet = setInterval(() => {
        const addr = window.SmicWallet?.getAddress?.();
        if (addr && addr !== walletAddress) {
            walletAddress = addr;
            updateProfileWidget();
            clearInterval(checkWallet);
        }
    }, 300);

    // Also hook directly
    window.__onWalletConnected = (addr) => {
        walletAddress = addr;
        updateProfileWidget();
    };

    // Lobby: add leaderboard button
    if (document.querySelector('.game-grid')) initLeaderboardBtn();
});

// Expose for wallet.js to call
window.SmicProfile = { updateWidget: updateProfileWidget };
