'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const EventEmitter = require('events');
const store = '/run/mgu-render/render.sock', community = '/run/mgu-renderd/renderd.sock';
function load(existing, env) {
    const calls = [], sockets = [], module = {exports: {}};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../kit/runtime/renderd.js'), 'utf8'), {
        module, process: {env: env || {}}, Buffer, setTimeout, clearTimeout, setInterval, clearInterval, setImmediate,
        require(name) {
            if (name === 'events') return EventEmitter;
            if (name === './record') return {};
            if (name === 'fs') return {statSync: p => ({isSocket: () => existing.indexOf(p) >= 0})};
            if (name === 'net') return {createConnection(p) {
                calls.push(p); const s = new EventEmitter(); s.destroy = () => {}; sockets.push(s); return s;
            }};
            throw new Error(name);
        },
    });
    const client = new module.exports.RenderClient('test', {info() {}, warn() {}}, {});
    return {client, calls, sockets, api: module.exports};
}
let r = load([store, community]);
r.client.connect(); assert.strictEqual(r.calls[0], store);
r.sockets[0].emit('error', new Error('ECONNREFUSED'));
r.client.connect(); assert.strictEqual(r.calls[1], community); r.client.close();
r = load([community]); r.client.connect(); assert.strictEqual(r.calls[0], community); r.client.close();
r = load([store, community], {MGU_RENDERD_SOCKET: '/tmp/custom-render.sock'});
r.client.connect(); assert.strictEqual(r.calls[0], '/tmp/custom-render.sock'); r.client.close();
r = load([store, community]); r.client.opts.socket = '/tmp/client-render.sock';
r.client.connect(); assert.strictEqual(r.calls[0], '/tmp/client-render.sock'); r.client.close();
console.log('PASS: Store renderer priority, absent/refused fallback, environment and client overrides');
