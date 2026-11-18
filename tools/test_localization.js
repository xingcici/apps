'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
for (const id of ['cluster_themes', 'idrive_hud_widgets']) {
    const dir = path.join(root, 'dist', id, 'source', 'javascript');
    const source = require(path.join(root, 'apps', id, 'app.json'));
    const spec = require(path.join(dir, 'kit/app-spec.json'));
    const locale = require(path.join(dir, 'kit/locale.json'));
    const fonts = require(path.join(dir, 'kit/fonts'));
    const { t } = require(path.join(dir, 'kit/i18n'));
    const Hud = require(path.join(dir, 'hud'));
    const raster = require(path.join(dir, 'hud_text'));
    assert.strictEqual(locale.language, 'zh-CN');
    assert.strictEqual(spec.version, source.version);
    assert.strictEqual(spec.title, source.title);
    source.settings.forEach((setting, i) => {
        const built = spec.settings[i];
        assert.strictEqual(built.key, setting.key);
        assert.deepStrictEqual(built.default, setting.default);
        if (setting.options) assert.deepStrictEqual(built.options.map(x => x[0]), setting.options.map(x => x[0]));
        assert(/[\u4e00-\u9fff]/.test(built.label), 'Untranslated setting: ' + built.label);
    });
    assert.strictEqual(t('Readouts'), '数据项');
    assert.strictEqual(t('Comfort'), '舒适');
    assert.strictEqual(t('rpm'), 'rpm');
    assert.strictEqual(t('M340i'), 'M340i');
    const f = fonts.get('cjk', 24, '仪表');
    const text = Object.values(locale.strings).join('') + source.title + source.description;
    for (const ch of text) {
        if (/[\u3000-\u9fff\uff00-\uffef]/.test(ch)) assert(f.glyphs[ch.codePointAt(0)], 'Missing glyph: ' + ch);
    }
    const values = { oil: '100', 'u:temp': '°C', 'u:speed': 'KM/H', slotHead: 'BOOST', mediaTitle: 'Comfort', badge: 'M340i', gear: 'R', mode: 'SPORT' };
    const ctx = { _token: tok => values[tok] || '88' };
    const resolve = value => Hud.prototype._resolve.call(ctx, value);
    assert.strictEqual(resolve('OIL {{oil}}{{u:temp}}'), '机油 100°C');
    assert.strictEqual(resolve('{{mediaTitle}}'), 'Comfort');
    assert.strictEqual(resolve('{{badge}}'), 'M340i');
    assert.strictEqual(resolve('{{gear}}'), 'R');
    assert.strictEqual(resolve('{{u:speed}}'), 'KM/H');
    assert.strictEqual(resolve('{{mode}}'), '运动');
    const font = id === 'cluster_themes' ? 'head' : 'label';
    for (const label of ['增压', '机油 100°C', '冷机', '圣诞快乐']) {
        assert(raster.measure(label, font, 0) > 0);
        const pixels = raster.mask(220, 60, label, { font, align: 'center' });
        assert(pixels.some(x => x > 0), 'Blank Chinese text: ' + label);
        assert(!pixels.slice(0, 220).some(x => x > 0), 'Clipped Chinese text at top');
    }
    const VehicleState = require(path.join(dir, 'vehicle_state'));
    const log = { info() {}, warn() {} };
    for (const target of ['hud', 'panel']) {
        const state = new VehicleState(log, () => {}, target);
        try {
            assert.strictEqual(state.hold(), false);
            for (const n of [10, 12, 5, 2, 8, 7, 10]) {
                state.feed({ statusConditionVehicle: n });
                assert.strictEqual(state.hold(), target === 'hud' && (n <= 5 || n === 8 || n === 12));
                assert.strictEqual(state.drop(), target === 'hud' && (n <= 5 || n === 12));
            }
            state.feed({ statusConditionVehicle: 15 });
            assert.strictEqual(state.hold(), true);
            state.feed({ statusConditionVehicle: 'FAHREN' });
            assert.strictEqual(state.hold(), false);
        } finally { state.stop(); }
    }
    console.log(id + ': Chinese labels, glyphs, settings and power states passed');
}
