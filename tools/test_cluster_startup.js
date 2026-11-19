'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'kit/runtime/mgu.js'), 'utf8');
const block = runtime.slice(runtime.indexOf('    const step = (what, p, ms) => {'), runtime.indexOf('    await app.initialized();'));
assert(block.includes('impl.startBackground') && block.includes('wireSettings(ctx)'));
const run = new Function('impl', 'ctx', 'SPEC', 'ui', 'wireSettings', 'log', 'return (async () => {' + block + '})();');
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return {promise, resolve}; }
const tick = () => new Promise((r) => setImmediate(r));
async function lifecycle(impl, events) {
    const resources = deferred(), settings = deferred();
    const pending = run(impl, {}, {settings: [{key: 'test'}]}, {
        comp: () => ({updateResources: () => { events.push('resources'); return resources.promise; }}),
    }, () => { events.push('settings'); return settings.promise; }, {info() {}, warn() {}, error() { events.push('error'); }});
    await tick();
    assert.deepStrictEqual(events, impl.startBackground ? ['background', 'resources'] : ['resources']);
    resources.resolve(); await tick();
    assert.strictEqual(events[events.length - 1], 'settings');
    assert(!events.includes('start'));
    settings.resolve(); await pending;
    assert.strictEqual(events[events.length - 1], 'start');
    assert.strictEqual(events.filter((x) => x === 'start').length, 1);
}
async function main() {
    let events = [];
    await lifecycle({startBackground: () => events.push('background'), start: () => events.push('start')}, events);
    events = [];
    await lifecycle({start: () => events.push('start')}, events);
    const source = fs.readFileSync(path.join(root, 'apps/cluster_themes/main.js'), 'utf8');
    for (const broken of [false, true]) {
        let hooks, exit;
        events = [];
        vm.runInNewContext(source, {
            require(name) {
                if (name === './kit/mgu') return {run: (h) => { hooks = h; }};
                if (name === './hud') return class {
                    constructor() { if (broken) throw new Error('test'); events.push('construct'); }
                    start() { events.push('hud'); }
                    stop() { events.push('stop'); }
                };
                if (name === './page') return class { start() { events.push('page'); } };
                throw new Error(name);
            },
            process: {on: (event, fn) => { assert.strictEqual(event, 'exit'); exit = fn; }},
        });
        const ctx = {spec: {title: 'Cluster'}, log: {error: () => events.push('error')}};
        hooks.startBackground(ctx);
        assert.deepStrictEqual(events, broken ? ['error'] : ['construct', 'hud']);
        hooks.start(ctx);
        assert.deepStrictEqual(events, broken ? ['error'] : ['construct', 'hud', 'page']);
        if (exit) { exit(); assert.strictEqual(events[events.length - 1], 'stop'); }
    }
    console.log('PASS: cluster draws before pending settings UI; other apps retain order; failed initialization leaves no page');
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
