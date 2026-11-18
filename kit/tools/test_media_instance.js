'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '../..');
const media = 'de.bmw.infotainment.hmi.hmimediastate.HmiMediaState';
for (const id of ['cluster_themes', 'idrive_hud_widgets']) {
    const spec = JSON.parse(fs.readFileSync(path.join(root, 'apps', id, 'app.json'), 'utf8'));
    assert.strictEqual(spec.signals[media]._instances, 'HMI_CID');
}
const sandbox = {
    module: { exports: {} },
    require: () => class Sim { sample() { return {}; } },
    setInterval: () => 0,
};
vm.runInNewContext(fs.readFileSync(path.join(root, 'kit/runtime/car.js'), 'utf8'), sandbox);
const calls = [];
new sandbox.module.exports({
    spec: { config: {} },
    log: { info() {} },
    signals: { watch(iface, instance, handlers) { calls.push({ iface, instance, handlers }); return Promise.resolve({}); } },
}, ['rpm'], { [media]: { playerMetadata() {}, trackProgress() {} } });
assert.strictEqual(calls.find((c) => c.iface === media).instance, 'HMI_CID');
assert.strictEqual(calls.find((c) => c.iface === 'de.bmw.infotainment.vehicle.CDS').instance, '1');
assert.deepStrictEqual(Object.keys(calls.find((c) => c.iface === media).handlers).sort(), ['playerMetadata', 'trackProgress']);
console.log('Media instance checks passed');
