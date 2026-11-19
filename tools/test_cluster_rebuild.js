'use strict';
const assert = require('assert');
const path = require('path');
const root = path.resolve(__dirname, '..');
const Hud = require(path.join(root, 'dist/cluster_themes/source/javascript/hud'));
const original = require(path.join(root, 'apps/cluster_themes/hud/layouts/gt3.json'));
const spec = require(path.join(root, 'apps/cluster_themes/app.json'));
const values = {};
spec.settings.forEach((s) => { values[s.key] = s.default; });
Object.assign(values, { mapUp: false, showBoost: true });
const clients = [], operations = [];
function clientAt(ci) {
    if (!clients[ci]) {
        let next = 1;
        const layers = new Map();
        const add = (kind, opts) => {
            const ref = next++;
            layers.set(ref, { kind, opts, uniforms: {} });
            assert(layers.size <= 8, 'per-client layer budget exceeded');
            operations.push(['add', ci, ref]);
            return ref;
        };
        clients[ci] = {
            ready: true, layers,
            effect: (opts) => add('effect', opts), image: (opts) => add('image', opts),
            drop(ref) { assert(layers.delete(ref)); operations.push(['drop', ci, ref]); },
            uniform(ref, name, value) { assert(layers.has(ref)); layers.get(ref).uniforms[name] = value; },
            pixels(ref) { assert(layers.has(ref)); }, status() {},
        };
    }
    return clients[ci];
}
let name = 'gt3', layout = JSON.parse(JSON.stringify(original));
const hud = Object.create(Hud.prototype);
Object.assign(hud, {
    ctx: { settings: { item: (key) => spec.settings.find((s) => s.key === key) } },
    target: 'panel', size: [1920, 720], client: clientAt(0), clients,
    widgets: new Map(), sheets: [], placed: [], layerStates: new Map(), stallTimers: new Map(),
    car: { setRedline() {} }, log: { info() {}, warn() {} },
    layouts: { load() { if (!layout) throw new Error('invalid layout'); return JSON.parse(JSON.stringify(layout)); } },
    setting: (key) => values[key], _layoutName: () => name, _clientAt: clientAt,
    _vehKeep: () => false, _holidayNow: () => null, _hudHoliday: () => null,
    _nightDim: () => false, _themeName: () => 'gt3', _wazeWant() {}, _setNeeds() {},
    _garlandHoliday: () => null, _atlasBytes: () => 0, _status() {},
    _guard: (label, fn) => fn(), _update() {},
});
function rebuild() {
    try { hud._rebuildInner(); } finally { clearTimeout(hud.statusAskT); }
    assert(hud.pixelBytes <= 16 * 1024 * 1024, 'pixel budget exceeded');
    assert.strictEqual(clients.reduce((n, c) => n + c.layers.size, 0), hud._layerRefs().length, 'untracked layers');
}
try {
    rebuild();
    const first = hud.widgets.get('frame');
    const ref = first.ref;
    for (const on of [true, false, true, false]) {
        operations.length = 0;
        values.mapUp = on;
        rebuild();
        assert.strictEqual(hud.widgets.get('frame').ref, ref, 'map transition replaced the opaque background');
        assert(!operations.some((op) => op[1] === first.ci && op[2] === ref), 'background was dropped or recreated');
        const uniforms = first.c.layers.get(ref).uniforms;
        assert.deepStrictEqual(uniforms.u_hole, on ? [430, 136, 1060, 458] : [0, 0, 0, 0]);
        assert.strictEqual(uniforms.u_n[0], on ? 6 : 7);
        assert.strictEqual(hud.widgets.has('revs_map'), on);
        assert.strictEqual(hud.widgets.has('revs'), !on);
    }
    layout.widgets[0].holeInset = 8;
    rebuild();
    assert.notStrictEqual(hud.widgets.get('frame').ref, ref, 'changed background definition reused');
    const changed = hud.widgets.get('frame').ref;
    name = 'another_layout';
    rebuild();
    assert.notStrictEqual(hud.widgets.get('frame').ref, changed, 'different layout reused the background');
    name = 'off';
    rebuild();
    assert.strictEqual(hud.widgets.size, 0, 'Off left the background up');
    name = 'gt3';
    rebuild();
    layout = null;
    rebuild();
    assert.strictEqual(hud.widgets.size, 0, 'invalid layout left stale layers up');
    assert.strictEqual(hud.problem, 'invalid layout');
    layout = JSON.parse(JSON.stringify(original));
    hud.target = 'hud';
    rebuild();
    const hudRef = hud.widgets.get('frame').ref;
    rebuild();
    assert.notStrictEqual(hud.widgets.get('frame').ref, hudRef, 'HUD unexpectedly retained a background');
    console.log('PASS: GT3 map transitions retain the background; window/boxes update; Off, invalid and changed layouts release it; layer/memory budgets hold');
} finally {
    clearTimeout(hud.statusAskT);
}
