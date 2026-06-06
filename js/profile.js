/**
 * SMIC GAME HUB — Profile & Leaderboard System
 * Handles: Gmail OAuth simulation, profile setup, avatar upload, score tracking
 */

// ── STORAGE HELPERS ─────────────────────────────────────────────────────────
const DB = {
    get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
    del: (k)    => localStorage.removeItem(k),
};

// ── PROFILE API ─────────────────────────────────────────────────────────────
const Profile = {
    KEY: 'smicProfile',

    get() { return DB.get(this.KEY); },

    save(data) { DB.set(this.KEY, { ...this.get(), ...data }); },

    clear() { DB.del(this.KEY); },

    isLoggedIn() { return !!(this.get()?.email); },

    addScore(points) {
        const p = this.get();
        if (!p) return;
        const score = (p.score || 0) + points;
        const wins  = (p.wins  || 0) + 1;
        this.save({ score, wins });
    },

    getScore() { return this.get()?.score || 0; },
};

// ── GOOGLE OAUTH (SIMULATED via Google Identity Services) ────────────────────
// In production wire this to a real GIS client_id.
// Here we simulate with a popup form so the hub works offline.
function triggerGoogleLogin(onSuccess) {
    // Build overlay
    const overlay = document.createElement('div');
    overlay.id = 'googleAuthOverlay';
    overlay.innerHTML = `
    <div class="gauth-modal">
        <div class="gauth-logo">
            <svg width="40" height="40" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        </div>
        <h3>Connect with Google</h3>
        <p>Sign in with your Gmail to unlock your profile & leaderboard</p>
        <div class="gauth-field">
            <label>Gmail address</label>
            <input type="email" id="gauthEmail" placeholder="you@gmail.com" autocomplete="email">
        </div>
        <div class="gauth-field">
            <label>Display name</label>
            <input type="text" id="gauthName" placeholder="Your name" maxlength="24">
        </div>
        <div class="gauth-error" id="gauthError"></div>
        <button class="gauth-submit" id="gauthSubmit">
            <svg width="18" height="18" viewBox="0 0 48 48" style="margin-right:8px;vertical-align:middle"><path fill="#fff" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#fff" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#fff" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#fff" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Sign in with Google
        </button>
        <button class="gauth-cancel" id="gauthCancel">Cancel</button>
    </div>`;
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:9999;
        background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);
        display:flex;align-items:center;justify-content:center;`;
    document.body.appendChild(overlay);

    overlay.querySelector('#gauthCancel').onclick = () => overlay.remove();
    overlay.querySelector('#gauthSubmit').onclick = () => {
        const email = overlay.querySelector('#gauthEmail').value.trim();
        const name  = overlay.querySelector('#gauthName').value.trim();
        const errEl = overlay.querySelector('#gauthError');
        if (!email.match(/^[^@]+@gmail\.com$/i)) {
            errEl.textContent = 'Please enter a valid Gmail address.'; return;
        }
        if (!name) { errEl.textContent = 'Please enter a display name.'; return; }
        Profile.save({ email, name, score: 0, wins: 0, avatar: null, joined: Date.now() });
        overlay.remove();
        if (onSuccess) onSuccess(Profile.get());
    };
}

// ── PROFILE MODAL ────────────────────────────────────────────────────────────
function openProfileModal() {
    const existing = document.getElementById('profileModal');
    if (existing) existing.remove();

    const p = Profile.get();
    const modal = document.createElement('div');
    modal.id = 'profileModal';
    modal.innerHTML = `
    <div class="pm-backdrop"></div>
    <div class="pm-panel">
        <button class="pm-close" id="pmClose">✕</button>
        <div class="pm-header">
            <div class="pm-avatar-wrap">
                <div class="pm-avatar" id="pmAvatar">
                    ${p?.avatar
                        ? `<img src="${p.avatar}" alt="avatar">`
                        : `<span>${p?.name ? p.name[0].toUpperCase() : '?'}</span>`}
                </div>
                ${p ? `<label class="pm-avatar-change" title="Change photo">
                    📷
                    <input type="file" id="pmAvatarInput" accept="image/*" style="display:none">
                </label>` : ''}
            </div>
            <div class="pm-info">
                <div class="pm-name" id="pmName">${p?.name || 'Guest'}</div>
                <div class="pm-email">${p?.email || 'Not connected'}</div>
                ${p ? `<div class="pm-score-line">🏆 <b>${p.score || 0}</b> pts &nbsp;|&nbsp; 🎮 <b>${p.wins || 0}</b> wins</div>` : ''}
            </div>
        </div>

        ${p ? `
        <div class="pm-section">
            <label class="pm-label">Display Name</label>
            <div class="pm-edit-row">
                <input class="pm-input" id="pmNameInput" type="text" value="${p.name}" maxlength="24" placeholder="Your name">
                <button class="pm-save-btn" id="pmSaveName">Save</button>
            </div>
        </div>
        <button class="pm-logout" id="pmLogout">Sign out</button>
        ` : `
        <div class="pm-guest-block">
            <p>Connect your Gmail to save scores and appear on the leaderboard.</p>
            <button class="pm-google-btn" id="pmGoogleBtn">
                <svg width="18" height="18" viewBox="0 0 48 48" style="vertical-align:middle;margin-right:8px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Connect Gmail
            </button>
        </div>`}
    </div>`;
    document.body.appendChild(modal);

    modal.querySelector('.pm-backdrop').onclick = () => modal.remove();
    modal.querySelector('#pmClose').onclick = () => modal.remove();

    if (!p) {
        modal.querySelector('#pmGoogleBtn').onclick = () => {
            modal.remove();
            triggerGoogleLogin(() => { initProfileWidget(); openProfileModal(); });
        };
        return;
    }

    // Avatar upload
    const avatarInput = modal.querySelector('#pmAvatarInput');
    if (avatarInput) avatarInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            Profile.save({ avatar: ev.target.result });
            modal.remove(); initProfileWidget(); openProfileModal();
        };
        reader.readAsDataURL(file);
    };

    // Save name
    modal.querySelector('#pmSaveName')?.addEventListener('click', () => {
        const val = modal.querySelector('#pmNameInput').value.trim();
        if (val) { Profile.save({ name: val }); modal.remove(); initProfileWidget(); openProfileModal(); }
    });

    // Logout
    modal.querySelector('#pmLogout')?.addEventListener('click', () => {
        Profile.clear(); modal.remove(); initProfileWidget();
    });
}

// ── LEADERBOARD MODAL ────────────────────────────────────────────────────────
// Since this is a single-player local hub, leaderboard shows stored sessions.
// Extend this to a backend for multi-user.
function openLeaderboard() {
    const existing = document.getElementById('leaderboardModal');
    if (existing) existing.remove();

    const p = Profile.get();
    if (!p) {
        // Show "login required"
        const modal = document.createElement('div');
        modal.id = 'leaderboardModal';
        modal.innerHTML = `
        <div class="lb-backdrop"></div>
        <div class="lb-panel">
            <button class="pm-close" id="lbClose">✕</button>
            <h2 class="lb-title">🏆 LEADERBOARD</h2>
            <div class="lb-locked">
                <div style="font-size:3rem">🔒</div>
                <p>You need a profile to view the leaderboard.</p>
                <button class="pm-google-btn" id="lbLoginBtn">
                    <svg width="16" height="16" viewBox="0 0 48 48" style="vertical-align:middle;margin-right:6px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                    Connect Gmail
                </button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.querySelector('.lb-backdrop').onclick = () => modal.remove();
        modal.querySelector('#lbClose').onclick = () => modal.remove();
        modal.querySelector('#lbLoginBtn').onclick = () => {
            modal.remove();
            triggerGoogleLogin(() => { initProfileWidget(); openLeaderboard(); });
        };
        return;
    }

    // Load leaderboard entries from localStorage (all devices on same browser)
    const entries = getLBEntries();
    // Ensure current user is present
    const meInList = entries.find(e => e.email === p.email);
    if (!meInList) entries.push({ name: p.name, email: p.email, score: p.score || 0, wins: p.wins || 0, avatar: p.avatar });
    entries.sort((a, b) => b.score - a.score);

    const rows = entries.slice(0, 10).map((e, i) => {
        const isMe = e.email === p.email;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`;
        const avatarHtml = e.avatar
            ? `<img src="${e.avatar}" alt="av" class="lb-av-img">`
            : `<span class="lb-av-letter">${e.name[0].toUpperCase()}</span>`;
        return `<div class="lb-row ${isMe ? 'lb-me' : ''}">
            <span class="lb-rank">${medal}</span>
            <div class="lb-avatar">${avatarHtml}</div>
            <div class="lb-player">
                <div class="lb-player-name">${e.name}${isMe ? ' <span class="lb-you">YOU</span>' : ''}</div>
                <div class="lb-player-wins">${e.wins || 0} wins</div>
            </div>
            <div class="lb-pts">${e.score || 0} <span>pts</span></div>
        </div>`;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'leaderboardModal';
    modal.innerHTML = `
    <div class="lb-backdrop"></div>
    <div class="lb-panel">
        <button class="pm-close" id="lbClose">✕</button>
        <h2 class="lb-title">🏆 LEADERBOARD</h2>
        <div class="lb-your-card">
            <div class="lb-your-label">Your Score</div>
            <div class="lb-your-score">${p.score || 0} <span>pts</span></div>
            <div class="lb-your-wins">${p.wins || 0} wins · ${p.name}</div>
        </div>
        <div class="lb-list">${rows || '<div class="lb-empty">No scores yet. Play a game!</div>'}</div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.lb-backdrop').onclick = () => modal.remove();
    modal.querySelector('#lbClose').onclick = () => modal.remove();
}

// Leaderboard multi-entry support (store all-time per email)
function getLBEntries() {
    return DB.get('smicLeaderboard') || [];
}

function syncLBEntry() {
    const p = Profile.get();
    if (!p) return;
    let entries = getLBEntries();
    const idx = entries.findIndex(e => e.email === p.email);
    const entry = { name: p.name, email: p.email, score: p.score || 0, wins: p.wins || 0, avatar: p.avatar };
    if (idx >= 0) entries[idx] = entry; else entries.push(entry);
    DB.set('smicLeaderboard', entries);
}

// ── SCORE AWARD (called from game pages) ─────────────────────────────────────
function awardWin() {
    Profile.addScore(10);
    syncLBEntry();
}
window.awardWin = awardWin; // expose globally for game JS

// ── PROFILE WIDGET (floating button) ─────────────────────────────────────────
function initProfileWidget() {
    // Remove existing
    document.getElementById('profileWidget')?.remove();

    const p = Profile.get();
    const widget = document.createElement('div');
    widget.id = 'profileWidget';

    const avatarHtml = p?.avatar
        ? `<img src="${p.avatar}" alt="av" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">`
        : p
            ? `<span style="font-size:1rem;font-weight:900;color:#ffd700;">${p.name[0].toUpperCase()}</span>`
            : `<span style="font-size:1.2rem">👤</span>`;

    widget.innerHTML = `
        <button class="pw-btn" id="pwProfileBtn" title="Profile">${avatarHtml}</button>
        <div class="pw-score" id="pwScore" style="${p ? '' : 'display:none'}">${p?.score || 0} pts</div>`;
    document.body.appendChild(widget);
    widget.querySelector('#pwProfileBtn').onclick = openProfileModal;
}

// ── LEADERBOARD BUTTON (lobby only) ──────────────────────────────────────────
function initLeaderboardBtn() {
    document.getElementById('lbFloatBtn')?.remove();
    const btn = document.createElement('button');
    btn.id = 'lbFloatBtn';
    btn.innerHTML = '🏆 LEADERBOARD';
    btn.onclick = openLeaderboard;
    document.body.appendChild(btn);
}

// ── STYLES ───────────────────────────────────────────────────────────────────
(function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
    /* ── Profile Widget ── */
    #profileWidget {
        position: fixed;
        top: 16px;
        left: 16px;
        z-index: 500;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }
    .pw-btn {
        width: 44px; height: 44px;
        border-radius: 50%;
        border: 2px solid rgba(255,215,0,0.5);
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(8px);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: border-color 0.2s, transform 0.15s;
        padding: 0;
    }
    .pw-btn:hover { border-color: #ffd700; transform: scale(1.08); }
    .pw-score {
        font-size: 0.65rem;
        font-weight: 900;
        color: #ffd700;
        letter-spacing: 1px;
        text-shadow: 0 1px 4px rgba(0,0,0,0.8);
        white-space: nowrap;
    }

    /* ── Leaderboard Float Btn ── */
    #lbFloatBtn {
        position: fixed;
        bottom: 28px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 500;
        padding: 10px 28px;
        font-family: 'Bangers', cursive;
        font-size: 1.1rem;
        letter-spacing: 3px;
        color: #ffd700;
        background: rgba(0,0,0,0.6);
        border: 2px solid rgba(255,215,0,0.4);
        border-radius: 40px;
        cursor: pointer;
        backdrop-filter: blur(8px);
        transition: background 0.2s, border-color 0.2s, transform 0.15s;
        box-shadow: 0 0 20px rgba(255,215,0,0.15);
    }
    #lbFloatBtn:hover {
        background: rgba(255,215,0,0.15);
        border-color: #ffd700;
        transform: translateX(-50%) scale(1.04);
        box-shadow: 0 0 30px rgba(255,215,0,0.35);
    }

    /* ── Google Auth Modal ── */
    .gauth-modal {
        background: #13172a;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 20px;
        padding: 36px 32px;
        width: min(420px, 92vw);
        display: flex; flex-direction: column; gap: 16px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.7);
        animation: pmSlideIn 0.25s cubic-bezier(.34,1.56,.64,1);
    }
    .gauth-logo { display: flex; justify-content: center; }
    .gauth-modal h3 { font-size: 1.4rem; font-weight: 900; color: #fff; text-align: center; margin: 0; }
    .gauth-modal p { font-size: 0.85rem; color: rgba(255,255,255,0.5); text-align: center; }
    .gauth-field { display: flex; flex-direction: column; gap: 6px; }
    .gauth-field label { font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.5); letter-spacing: 1px; text-transform: uppercase; }
    .gauth-field input {
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.07);
        color: #fff; font-size: 0.95rem;
        outline: none;
    }
    .gauth-field input:focus { border-color: #4285F4; }
    .gauth-error { font-size: 0.8rem; color: #EA4335; min-height: 16px; }
    .gauth-submit {
        padding: 12px;
        border-radius: 12px;
        border: none;
        background: #4285F4;
        color: #fff; font-size: 0.95rem; font-weight: 700;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s;
    }
    .gauth-submit:hover { background: #3070e0; }
    .gauth-cancel {
        background: none; border: none; color: rgba(255,255,255,0.35);
        font-size: 0.85rem; cursor: pointer; text-align: center;
        text-decoration: underline;
    }

    /* ── Profile Modal ── */
    #profileModal, #leaderboardModal {
        position: fixed; inset: 0; z-index: 9000;
        display: flex; align-items: center; justify-content: center;
    }
    .pm-backdrop, .lb-backdrop {
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.7); backdrop-filter: blur(6px);
    }
    .pm-panel {
        position: relative; z-index: 1;
        background: #13172a;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 24px;
        padding: 32px 28px;
        width: min(420px, 92vw);
        display: flex; flex-direction: column; gap: 20px;
        box-shadow: 0 32px 80px rgba(0,0,0,0.8);
        animation: pmSlideIn 0.25s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes pmSlideIn {
        from { opacity: 0; transform: scale(0.9) translateY(16px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .pm-close {
        position: absolute; top: 14px; right: 16px;
        background: rgba(255,255,255,0.08); border: none;
        color: rgba(255,255,255,0.5); border-radius: 50%;
        width: 30px; height: 30px; cursor: pointer; font-size: 0.85rem;
        transition: background 0.2s;
    }
    .pm-close:hover { background: rgba(255,255,255,0.16); color: #fff; }
    .pm-header { display: flex; gap: 16px; align-items: center; }
    .pm-avatar-wrap { position: relative; flex-shrink: 0; }
    .pm-avatar {
        width: 72px; height: 72px;
        border-radius: 50%;
        border: 3px solid rgba(255,215,0,0.4);
        background: linear-gradient(135deg, #1a1f38, #252c4a);
        display: flex; align-items: center; justify-content: center;
        overflow: hidden; font-size: 2rem;
    }
    .pm-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .pm-avatar-change {
        position: absolute; bottom: -4px; right: -4px;
        background: #ffd700; border-radius: 50%;
        width: 24px; height: 24px;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.75rem; cursor: pointer;
        border: 2px solid #13172a;
    }
    .pm-info { flex: 1; min-width: 0; }
    .pm-name { font-size: 1.25rem; font-weight: 900; color: #fff; }
    .pm-email { font-size: 0.78rem; color: rgba(255,255,255,0.4); margin-top: 2px; }
    .pm-score-line { font-size: 0.8rem; color: #ffd700; margin-top: 6px; font-weight: 700; }
    .pm-section { display: flex; flex-direction: column; gap: 8px; }
    .pm-label { font-size: 0.72rem; font-weight: 700; color: rgba(255,255,255,0.4); letter-spacing: 1px; text-transform: uppercase; }
    .pm-edit-row { display: flex; gap: 8px; }
    .pm-input {
        flex: 1; padding: 9px 12px;
        border-radius: 10px; border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.07); color: #fff; font-size: 0.9rem;
        outline: none;
    }
    .pm-input:focus { border-color: #ffd700; }
    .pm-save-btn {
        padding: 9px 16px; border-radius: 10px; border: none;
        background: #ffd700; color: #000; font-weight: 900; font-size: 0.85rem;
        cursor: pointer; transition: background 0.2s;
    }
    .pm-save-btn:hover { background: #f0c800; }
    .pm-logout {
        padding: 10px; border-radius: 12px;
        border: 1px solid rgba(255,80,80,0.3); background: rgba(255,80,80,0.1);
        color: #ff7070; font-size: 0.85rem; font-weight: 700;
        cursor: pointer; transition: background 0.2s;
    }
    .pm-logout:hover { background: rgba(255,80,80,0.2); }
    .pm-guest-block { display: flex; flex-direction: column; gap: 12px; align-items: center; text-align: center; }
    .pm-guest-block p { color: rgba(255,255,255,0.5); font-size: 0.88rem; }
    .pm-google-btn {
        padding: 12px 20px; border-radius: 12px; border: none;
        background: #fff; color: #444; font-size: 0.92rem; font-weight: 700;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.2s; width: 100%;
    }
    .pm-google-btn:hover { background: #f0f0f0; }

    /* ── Leaderboard Panel ── */
    .lb-panel {
        position: relative; z-index: 1;
        background: #13172a;
        border: 1px solid rgba(255,215,0,0.15);
        border-radius: 24px;
        padding: 28px 24px;
        width: min(460px, 94vw);
        max-height: 88vh;
        display: flex; flex-direction: column; gap: 16px;
        box-shadow: 0 32px 80px rgba(0,0,0,0.85), 0 0 40px rgba(255,215,0,0.06);
        animation: pmSlideIn 0.25s cubic-bezier(.34,1.56,.64,1);
        overflow: hidden;
    }
    .lb-title {
        font-family: 'Bangers', cursive;
        font-size: 2rem; letter-spacing: 4px; color: #ffd700;
        text-align: center; margin: 0;
        text-shadow: 0 0 20px rgba(255,215,0,0.4);
    }
    .lb-your-card {
        background: linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,215,0,0.04));
        border: 1px solid rgba(255,215,0,0.25);
        border-radius: 14px; padding: 14px 18px; text-align: center;
    }
    .lb-your-label { font-size: 0.7rem; font-weight: 700; color: rgba(255,215,0,0.6); letter-spacing: 2px; text-transform: uppercase; }
    .lb-your-score { font-size: 2.2rem; font-weight: 900; color: #ffd700; line-height: 1.1; }
    .lb-your-score span { font-size: 1rem; opacity: 0.6; }
    .lb-your-wins { font-size: 0.78rem; color: rgba(255,255,255,0.4); margin-top: 2px; }
    .lb-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 350px; padding-right: 4px; }
    .lb-list::-webkit-scrollbar { width: 4px; }
    .lb-list::-webkit-scrollbar-track { background: transparent; }
    .lb-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
    .lb-row {
        display: flex; align-items: center; gap: 12px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 12px; padding: 10px 14px;
        transition: background 0.2s;
    }
    .lb-row.lb-me {
        background: rgba(255,215,0,0.08);
        border-color: rgba(255,215,0,0.2);
    }
    .lb-rank { font-size: 1.1rem; width: 28px; text-align: center; flex-shrink: 0; }
    .lb-avatar {
        width: 36px; height: 36px; border-radius: 50%;
        overflow: hidden; flex-shrink: 0;
        background: linear-gradient(135deg, #252c4a, #1a1f38);
        display: flex; align-items: center; justify-content: center;
        border: 2px solid rgba(255,255,255,0.1);
    }
    .lb-av-img { width: 100%; height: 100%; object-fit: cover; }
    .lb-av-letter { font-size: 1rem; font-weight: 900; color: #ffd700; }
    .lb-player { flex: 1; min-width: 0; }
    .lb-player-name { font-size: 0.9rem; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lb-player-wins { font-size: 0.72rem; color: rgba(255,255,255,0.35); }
    .lb-you { font-size: 0.6rem; background: #ffd700; color: #000; border-radius: 4px; padding: 1px 5px; font-weight: 900; letter-spacing: 1px; vertical-align: middle; margin-left: 4px; }
    .lb-pts { font-size: 1.1rem; font-weight: 900; color: #ffd700; flex-shrink: 0; }
    .lb-pts span { font-size: 0.7rem; opacity: 0.5; }
    .lb-empty { text-align: center; color: rgba(255,255,255,0.3); padding: 20px; font-size: 0.85rem; }
    .lb-locked { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 20px 0; color: rgba(255,255,255,0.5); font-size: 0.9rem; text-align: center; }
    `;
    document.head.appendChild(style);
})();

// ── AUTO-INIT ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initProfileWidget();
    // If lobby page, add leaderboard button
    if (document.getElementById('card-tug') || document.querySelector('.game-grid')) {
        initLeaderboardBtn();
    }
    // Sync leaderboard entry on page load
    syncLBEntry();
});
