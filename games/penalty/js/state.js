// ── STATE ────────────────────────────────────────────────
// Object duy nhất được import và mutate bởi các module khác
export const state = {
    mode:          'shooter',
    round:         0,
    playerScore:   0,
    botScore:      0,
    playerHistory: [],
    botHistory:    [],
    busy:          false,
};

export function resetState(selectedMode) {
    state.mode          = selectedMode;
    state.round         = 0;
    state.playerScore   = 0;
    state.botScore      = 0;
    state.playerHistory = [];
    state.botHistory    = [];
    state.busy          = false;
}
