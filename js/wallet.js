// ============================================================
//  wallet.js  –  SMIC GAME HUB  ×  Seismic Testnet
//  Chain ID   : 5124 (0x1404)
//  RPC        : https://testnet-2.seismictest.net/rpc
//  Explorer   : https://seismic-testnet.socialscan.io/
//  Faucet     : https://community-faucet.seismictest.net/
// ============================================================

const SEISMIC_CHAIN_ID   = '0x1404';   // 5124 decimal
const SEISMIC_CHAIN_NAME = 'Seismic Testnet';
const SEISMIC_RPC        = 'https://testnet-2.seismictest.net/rpc';
const SEISMIC_EXPLORER   = 'https://seismic-testnet.socialscan.io/';
const SEISMIC_FAUCET     = 'https://community-faucet.seismictest.net/';

// ── State ────────────────────────────────────────────────────
let walletAddress  = null;
let activeProvider = null;

// ── Provider detection ───────────────────────────────────────
function detectProviders() {
    const seen = new Set(), list = [];
    const add = (p, label) => { if (!p || seen.has(p)) return; seen.add(p); list.push({ provider: p, label }); };

    if (window.ethereum) {
        const providers = window.ethereum.providers;
        if (Array.isArray(providers) && providers.length)
            providers.forEach(p => add(p, guessWalletName(p)));
        else
            add(window.ethereum, guessWalletName(window.ethereum));
    }
    if (window.phantom?.ethereum)       add(window.phantom.ethereum,        'Phantom');
    if (window.coinbaseWalletExtension) add(window.coinbaseWalletExtension, 'Coinbase Wallet');
    if (window.trustwallet)             add(window.trustwallet,             'Trust Wallet');
    if (window.okxwallet)               add(window.okxwallet,               'OKX Wallet');
    if (window.bitkeep?.ethereum)       add(window.bitkeep.ethereum,        'Bitget Wallet');
    if (window.rabby)                   add(window.rabby,                   'Rabby');
    return list;
}

function guessWalletName(p) {
    if (!p) return 'EVM Wallet';
    if (p.isPhantom)                        return 'Phantom';
    if (p.isMetaMask)                       return 'MetaMask';
    if (p.isCoinbaseWallet)                 return 'Coinbase Wallet';
    if (p.isBraveWallet)                    return 'Brave Wallet';
    if (p.isTrust)                          return 'Trust Wallet';
    if (p.isOKExWallet || p.isOkxWallet)   return 'OKX Wallet';
    if (p.isBitKeep)                        return 'Bitget Wallet';
    if (p.isRabby)                          return 'Rabby';
    if (p.isTokenPocket)                    return 'TokenPocket';
    if (p.isImToken)                        return 'imToken';
    return 'EVM Wallet';
}

function walletIcon(name) {
    const map = {
        'MetaMask':'🦊','Phantom':'👻','Coinbase Wallet':'🔵','Brave Wallet':'🦁',
        'Trust Wallet':'🛡️','OKX Wallet':'⭕','Bitget Wallet':'💎',
        'Rabby':'🐇','TokenPocket':'📱','imToken':'🔑','EVM Wallet':'💼',
    };
    return map[name] || '💼';
}

// ── Switch to Seismic Testnet ─────────────────────────────────
async function switchToSeismic() {
    const provider = activeProvider || window.ethereum;
    if (!provider) return;
    try {
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEISMIC_CHAIN_ID }]
        });
    } catch (err) {
        if (err.code === 4902 || err.code === -32603) {
            await provider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: SEISMIC_CHAIN_ID,
                    chainName: SEISMIC_CHAIN_NAME,
                    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    rpcUrls: [SEISMIC_RPC],
                    blockExplorerUrls: [SEISMIC_EXPLORER]
                }]
            });
        } else {
            throw err;
        }
    }
}

// ── Wallet picker modal ───────────────────────────────────────
function openWalletPicker() {
    // Remove existing
    document.getElementById('smicWalletPicker')?.remove();

    const providers = detectProviders();
    const modal = document.createElement('div');
    modal.id = 'smicWalletPicker';

    const rows = providers.length === 0
        ? `<div class="swp-empty">
            No EVM wallet found.<br>
            <a href="https://metamask.io" target="_blank">Install MetaMask</a>
           </div>`
        : providers.map(({ provider, label }) =>
            `<div class="swp-item" data-label="${label}">
                <span class="swp-icon">${walletIcon(label)}</span>
                <span class="swp-name">${label}</span>
                <span class="swp-arrow">→</span>
             </div>`
          ).join('');

    modal.innerHTML = `
    <div class="swp-backdrop"></div>
    <div class="swp-box">
        <div class="swp-header">
            <div class="swp-title">
                <span class="swp-chain-dot"></span>
                Connect to Seismic Testnet
            </div>
            <button class="swp-close" id="swpClose">✕</button>
        </div>
        <div class="swp-network-badge">
            <span class="swp-net-icon">⚡</span>
            <div>
                <div class="swp-net-name">Seismic Testnet</div>
                <div class="swp-net-id">Chain ID: 5124</div>
            </div>
            <a href="${SEISMIC_FAUCET}" target="_blank" class="swp-faucet-link">Get tokens →</a>
        </div>
        <div class="swp-list">${rows}</div>
    </div>`;
    document.body.appendChild(modal);

    modal.querySelector('.swp-backdrop').onclick = () => modal.remove();
    modal.querySelector('#swpClose').onclick = () => modal.remove();

    modal.querySelectorAll('.swp-item').forEach((el, i) => {
        el.onclick = () => {
            modal.remove();
            connectWithProvider(providers[i].provider);
        };
    });
}

// ── Connect logic ─────────────────────────────────────────────
async function connectWallet() {
    const providers = detectProviders();
    if (providers.length === 0) {
        showWalletToast('❌ No EVM wallet found. Install MetaMask!');
        return null;
    }
    if (providers.length === 1) return connectWithProvider(providers[0].provider);
    openWalletPicker();
    return null;
}

async function connectWithProvider(provider) {
    try {
        activeProvider = provider;
        window.ethereum = provider;
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        walletAddress = accounts[0];
        await switchToSeismic();
        updateWalletUI();
        attachProviderEvents(provider);
        showWalletToast('✅ Connected to Seismic Testnet!');
        return walletAddress;
    } catch (e) {
        if (e.code !== 4001) showWalletToast('❌ ' + (e.message || 'Connection failed'));
        return null;
    }
}

function attachProviderEvents(provider) {
    try { provider.removeAllListeners?.('accountsChanged'); } catch (_) {}
    try { provider.removeAllListeners?.('chainChanged'); } catch (_) {}

    provider.on('accountsChanged', accounts => {
        walletAddress = accounts[0] || null;
        updateWalletUI();
    });
    provider.on('chainChanged', () => window.location.reload());
}

function disconnectWallet() {
    walletAddress  = null;
    activeProvider = null;
    updateWalletUI();
    showWalletToast('🔌 Wallet disconnected.');
}

// ── UI ────────────────────────────────────────────────────────
function updateWalletUI() {
    const btn = document.getElementById('smicWalletBtn');
    if (!btn) return;
    if (walletAddress) {
        const short = walletAddress.slice(0, 6) + '…' + walletAddress.slice(-4);
        btn.innerHTML = `<span class="swb-dot connected"></span>${short}`;
        btn.classList.add('swb-connected');
        btn.title = walletAddress;
        btn.onclick = openWalletMenu;
    } else {
        btn.innerHTML = `<span class="swb-dot"></span>Connect Wallet`;
        btn.classList.remove('swb-connected');
        btn.onclick = connectWallet;
    }
}

function openWalletMenu() {
    document.getElementById('smicWalletMenu')?.remove();
    const btn = document.getElementById('smicWalletBtn');
    const rect = btn.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.id = 'smicWalletMenu';
    menu.innerHTML = `
        <div class="swm-addr">${walletAddress.slice(0,6)}…${walletAddress.slice(-4)}</div>
        <div class="swm-network"><span class="swb-dot connected" style="width:8px;height:8px"></span> Seismic Testnet</div>
        <hr class="swm-divider">
        <a class="swm-item" href="${SEISMIC_EXPLORER}address/${walletAddress}" target="_blank">🔍 View on Explorer</a>
        <a class="swm-item" href="${SEISMIC_FAUCET}" target="_blank">💧 Faucet</a>
        <button class="swm-item swm-disconnect" id="swmDisconnect">🔌 Disconnect</button>
    `;
    menu.style.cssText = `position:fixed;top:${rect.bottom + 8}px;right:${window.innerWidth - rect.right}px;z-index:9999`;
    document.body.appendChild(menu);
    menu.querySelector('#swmDisconnect').onclick = () => { menu.remove(); disconnectWallet(); };
    setTimeout(() => document.addEventListener('click', function h(e) {
        if (!menu.contains(e.target) && e.target !== btn) { menu.remove(); document.removeEventListener('click', h); }
    }), 10);
}

function showWalletToast(msg) {
    let t = document.getElementById('smicWalletToast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'smicWalletToast';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('swt-show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('swt-show'), 3000);
}

// ── Inject HTML buttons ───────────────────────────────────────
function injectWalletButtons() {
    // Wallet button — top right
    if (!document.getElementById('smicWalletBtn')) {
        const btn = document.createElement('button');
        btn.id = 'smicWalletBtn';
        btn.innerHTML = `<span class="swb-dot"></span>Connect Wallet`;
        btn.onclick = connectWallet;
        document.body.appendChild(btn);
    }
    // Faucet button — top left
    if (!document.getElementById('smicFaucetBtn')) {
        const fab = document.createElement('a');
        fab.id = 'smicFaucetBtn';
        fab.href = SEISMIC_FAUCET;
        fab.target = '_blank';
        fab.innerHTML = `💧 Faucet`;
        document.body.appendChild(fab);
    }
}

// ── Styles ────────────────────────────────────────────────────
(function injectWalletStyles() {
    const style = document.createElement('style');
    style.textContent = `
    /* ── Wallet button (top-right) ── */
    #smicWalletBtn {
        position: fixed; top: 16px; right: 16px; z-index: 500;
        display: flex; align-items: center; gap: 8px;
        padding: 9px 18px;
        background: rgba(10,14,26,0.75);
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: 40px;
        color: #fff; font-size: 0.82rem; font-weight: 700;
        cursor: pointer; letter-spacing: 0.5px;
        backdrop-filter: blur(10px);
        transition: border-color 0.2s, background 0.2s, transform 0.15s;
        font-family: 'Nunito', sans-serif;
    }
    #smicWalletBtn:hover {
        border-color: rgba(255,255,255,0.4);
        background: rgba(255,255,255,0.08);
        transform: translateY(-1px);
    }
    #smicWalletBtn.swb-connected {
        border-color: rgba(93,235,138,0.45);
        background: rgba(40,160,80,0.15);
        color: #5deb8a;
    }
    #smicWalletBtn.swb-connected:hover {
        background: rgba(40,160,80,0.22);
        border-color: #5deb8a;
    }
    .swb-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: rgba(255,255,255,0.3);
        display: inline-block; flex-shrink: 0;
        transition: background 0.2s;
    }
    .swb-dot.connected { background: #5deb8a; box-shadow: 0 0 6px #5deb8a; animation: pulseGreen 2s ease-in-out infinite; }
    @keyframes pulseGreen {
        0%,100% { box-shadow: 0 0 4px #5deb8a; } 50% { box-shadow: 0 0 10px #5deb8a, 0 0 20px rgba(93,235,138,0.3); }
    }

    /* ── Faucet button (top-left) ── */
    #smicFaucetBtn {
        position: fixed; top: 16px; left: 16px; z-index: 500;
        display: flex; align-items: center; gap: 6px;
        padding: 9px 18px;
        background: rgba(10,14,26,0.75);
        border: 1px solid rgba(93,235,138,0.25);
        border-radius: 40px;
        color: #5deb8a; font-size: 0.82rem; font-weight: 700;
        cursor: pointer; letter-spacing: 0.5px;
        backdrop-filter: blur(10px);
        text-decoration: none;
        transition: border-color 0.2s, background 0.2s, transform 0.15s;
        font-family: 'Nunito', sans-serif;
    }
    #smicFaucetBtn:hover {
        border-color: #5deb8a;
        background: rgba(40,160,80,0.15);
        transform: translateY(-1px);
    }

    /* ── Wallet picker modal ── */
    #smicWalletPicker {
        position: fixed; inset: 0; z-index: 9999;
        display: flex; align-items: center; justify-content: center;
    }
    .swp-backdrop {
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.72); backdrop-filter: blur(6px);
    }
    .swp-box {
        position: relative; z-index: 1;
        background: #0f1322;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 22px;
        padding: 26px 22px;
        width: min(400px, 92vw);
        display: flex; flex-direction: column; gap: 14px;
        box-shadow: 0 32px 80px rgba(0,0,0,0.85);
        animation: swpIn 0.22s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes swpIn {
        from { opacity:0; transform: scale(0.9) translateY(12px); }
        to   { opacity:1; transform: scale(1) translateY(0); }
    }
    .swp-header { display: flex; justify-content: space-between; align-items: center; }
    .swp-title { font-size: 1rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px; }
    .swp-chain-dot { width: 8px; height: 8px; border-radius: 50%; background: #5deb8a; box-shadow: 0 0 8px #5deb8a; }
    .swp-close {
        background: rgba(255,255,255,0.08); border: none;
        color: rgba(255,255,255,0.5); border-radius: 50%;
        width: 28px; height: 28px; cursor: pointer; font-size: 0.8rem;
        transition: background 0.2s;
    }
    .swp-close:hover { background: rgba(255,255,255,0.15); color: #fff; }
    .swp-network-badge {
        display: flex; align-items: center; gap: 12px;
        background: rgba(93,235,138,0.07);
        border: 1px solid rgba(93,235,138,0.18);
        border-radius: 12px; padding: 12px 14px;
    }
    .swp-net-icon { font-size: 1.4rem; }
    .swp-net-name { font-size: 0.88rem; font-weight: 800; color: #5deb8a; }
    .swp-net-id   { font-size: 0.72rem; color: rgba(255,255,255,0.35); margin-top: 1px; }
    .swp-faucet-link {
        margin-left: auto; font-size: 0.72rem; color: #5deb8a;
        text-decoration: none; font-weight: 700;
        border: 1px solid rgba(93,235,138,0.25); border-radius: 20px;
        padding: 4px 10px; white-space: nowrap;
        transition: background 0.2s;
    }
    .swp-faucet-link:hover { background: rgba(93,235,138,0.1); }
    .swp-list { display: flex; flex-direction: column; gap: 8px; }
    .swp-item {
        display: flex; align-items: center; gap: 12px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
        border-radius: 13px; padding: 13px 16px;
        cursor: pointer; transition: background 0.15s, border-color 0.15s;
    }
    .swp-item:hover { background: rgba(93,235,138,0.07); border-color: rgba(93,235,138,0.25); }
    .swp-icon { font-size: 1.5rem; }
    .swp-name { flex: 1; font-size: 0.92rem; font-weight: 700; color: #fff; }
    .swp-arrow { color: rgba(255,255,255,0.25); font-size: 0.85rem; }
    .swp-empty { text-align: center; color: rgba(255,255,255,0.4); font-size: 0.85rem; padding: 16px 0; }
    .swp-empty a { color: #5deb8a; }

    /* ── Wallet dropdown menu ── */
    #smicWalletMenu {
        background: #0f1322;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px; padding: 12px;
        min-width: 210px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.7);
        display: flex; flex-direction: column; gap: 4px;
        animation: swpIn 0.18s ease;
    }
    .swm-addr { font-size: 0.82rem; font-weight: 800; color: #fff; padding: 4px 8px; }
    .swm-network { font-size: 0.72rem; color: rgba(255,255,255,0.4); padding: 0 8px 6px; display: flex; align-items: center; gap: 6px; }
    .swm-divider { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 4px 0; }
    .swm-item {
        display: flex; align-items: center; gap: 8px;
        padding: 9px 10px; border-radius: 10px;
        color: rgba(255,255,255,0.7); font-size: 0.83rem; font-weight: 600;
        cursor: pointer; background: none; border: none; text-decoration: none; width: 100%;
        transition: background 0.15s, color 0.15s;
    }
    .swm-item:hover { background: rgba(255,255,255,0.07); color: #fff; }
    .swm-disconnect { color: #ff7070 !important; }
    .swm-disconnect:hover { background: rgba(255,80,80,0.1) !important; }

    /* ── Toast ── */
    #smicWalletToast {
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%) translateY(12px);
        background: rgba(15,19,34,0.95); border: 1px solid rgba(255,255,255,0.12);
        color: #fff; font-size: 0.85rem; font-weight: 700;
        padding: 10px 20px; border-radius: 40px;
        opacity: 0; pointer-events: none;
        transition: opacity 0.25s, transform 0.25s;
        z-index: 9999; white-space: nowrap;
        backdrop-filter: blur(8px);
        font-family: 'Nunito', sans-serif;
    }
    #smicWalletToast.swt-show { opacity: 1; transform: translateX(-50%) translateY(0); }
    `;
    document.head.appendChild(style);
})();

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    injectWalletButtons();
    updateWalletUI();

    // Auto-restore if already connected
    const providers = detectProviders();
    if (providers.length > 0) {
        const p = providers[0].provider;
        p.request({ method: 'eth_accounts' }).then(async accounts => {
            if (accounts.length) {
                walletAddress  = accounts[0];
                activeProvider = p;
                window.ethereum = p;
                try { await switchToSeismic(); } catch (_) {}
                updateWalletUI();
                attachProviderEvents(p);
            }
        }).catch(() => {});
    }
});

// ── Expose globals ────────────────────────────────────────────
window.SmicWallet = {
    connect:    connectWallet,
    disconnect: disconnectWallet,
    switchToSeismic,
    showToast:  showWalletToast,
    getAddress: () => walletAddress,
};
