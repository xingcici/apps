'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-shift-'));
process.env.REDLINE_SHARE_DIR = dir;
const AutoShift = require('../shared/auto_shift');
const ShiftScore = require('../shared/shift_score');
const ShiftCue = require('../shared/shift_cue');
const log = { info() {}, warn() {} };
const opts = { autoFollow: true, mode: 'D', drive: 'comfort', variant: null, redline: 7000, shiftBefore: 300, coldGuard: true };
let clock = Date.now(), data, listener;
const now = Date.now;
Date.now = () => clock;
const d = (rpm, gear, extra) => Object.assign({ rpm, gear, speed: 30, oil: 90, stage: 'D', demo: false }, extra);
function ramp(model, o, peak, extra, gear) {
    gear = gear || 1;
    for (let rpm = peak - 600; rpm <= peak; rpm += 100) {
        clock += 100; data = d(rpm, gear, extra); model.sample(data, clock, o);
    }
}
function upshift(model, o, peak, extra) {
    model.reset(); ramp(model, o, peak, extra);
    clock += 100; data = d(peak - 700, 2, extra); model.sample(data, clock, o);
}
try {
    const m = new AutoShift(dir, log);
    for (let i = 0; i < 2; i++) upshift(m, opts, 2200);
    m.reset(); ramp(m, opts, 2100);
    assert.strictEqual(m.point(data, opts, clock), null, 'requires three shifts');
    upshift(m, opts, 2250);
    m.reset(); ramp(m, opts, 2100);
    assert.strictEqual(m.point(data, opts, clock), 2200, 'learns shifts below 2500 rpm');
    assert.strictEqual(m.point(data, opts, clock + 751), null, 'stale samples');
    for (const patch of [{mode: 'M'}, {mode: null}, {mode: 'S'}, {drive: 'sport'}, {variant: 'plus'}, {testing: true}, {autoFollow: false}]) {
        assert.strictEqual(m.point(data, Object.assign({}, opts, patch), clock), null, JSON.stringify(patch));
    }
    for (const patch of [{oil: 40}, {demo: true}, {gearGuessed: true}, {gear: 2}, {stage: 'P'}, {speed: 0}, {rpm: null}]) {
        assert.strictEqual(m.point(Object.assign({}, data, patch), opts, clock), null, JSON.stringify(patch));
    }
    const saved = fs.readFileSync(m.file, 'utf8');
    for (const patch of [{mode: 'M'}, {mode: null}, {testing: true}, {autoFollow: false}]) upshift(m, Object.assign({}, opts, patch), 2200);
    for (const extra of [{demo: true}, {gearGuessed: true}, {stage: 'N'}, {speed: 0}, {oil: null}]) upshift(m, opts, 2200, extra);
    assert.strictEqual(fs.readFileSync(m.file, 'utf8'), saved, 'invalid sources must not teach');
    // A downshift, skipped gear, data gap or lift before the shift must not teach.
    for (const [to, gap] of [[0,100], [3,100], [2,1000]]) {
        m.reset(); ramp(m, opts, 2300); clock += gap; m.sample(d(1500,to),clock,opts);
    }
    m.reset(); ramp(m, opts, 2300);
    for (let i=0;i<6;i++) { clock+=100;m.sample(d(1600,1),clock,opts); }
    clock+=100;m.sample(d(1500,2),clock,opts);
    assert.strictEqual(fs.readFileSync(m.file, 'utf8'), saved);
    const restored = new AutoShift(dir,log);
    ramp(restored,opts,2100);
    assert.strictEqual(restored.point(data,opts,clock),2200,'history survives restart');
    restored.reset();
    for(let i=0;i<7;i++) {clock+=100;data=d(1400+i*200,1);restored.sample(data,clock,opts);}
    assert.strictEqual(restored.point(data,opts,clock),null,'different acceleration group');
    upshift(restored,opts,5000);
    restored.reset();ramp(restored,opts,2100);
    assert.strictEqual(restored.point(data,opts,clock),null,'inconsistent shifts fall back');

    fs.writeFileSync(m.file,saved);
    const car={data:()=>data,onSample:fn=>{listener=fn;}};
    const score=new ShiftScore(car,()=>opts,log,dir);
    const adapter={sample:(value,t)=>{data=value;listener(value,t);}};
    ramp(adapter,opts,2100);
    fs.writeFileSync(path.join(dir,'shift.json'),JSON.stringify({v:1,t:clock,shiftNow:6500}));
    assert.strictEqual(score.shiftPoint(90).rpm,2200,'auto prediction wins over shared Redline point');
    opts.mode='M';assert.strictEqual(score.shiftPoint(90).rpm,6500,'manual keeps Redline');opts.mode='D';
    opts.autoFollow=false;assert.strictEqual(score.shiftPoint(90).rpm,6500);opts.autoFollow=true;
    score.auto.point=()=>6800;
    assert.strictEqual(score.shiftPoint(30).rpm,4500,'cold guard caps prediction');
    assert.strictEqual(score.shiftPoint(90).rpm,6700,'normal limit caps prediction');

    const cue=new ShiftCue(dir,log),learn={mode:'D',autoFollow:true};
    cue.tick(2200,clock,2200,7000,150,1,2200,()=>true,learn);
    assert(cue.now.shift);
    cue.tick(1500,clock+100,2200,7000,150,2,2200,()=>true,learn);
    assert(!cue.now.shift);assert.strictEqual(cue.fraction(2200),0,'gear change clears even a lagging display RPM');
    cue.tick(1800,clock+200,2200,7000,150,2,2100,()=>true,learn);
    assert.strictEqual(cue.fraction(2100),0);
    assert.strictEqual(cue.shifts,0,'automatic shifts must not teach manual reaction time');
    const changed = new ShiftCue(dir,log);
    changed.tick(2200,clock,2200,7000,150,1,2200,()=>true,Object.assign({autoKey:'learned'},learn));
    assert(changed.now.shift);
    changed.tick(2300,clock+100,6700,7000,150,1,2300,()=>true,learn);
    assert(!changed.now.shift,'lost prediction must release an earlier automatic flash');
    fs.writeFileSync(m.file,'{broken');assert.deepStrictEqual(new AutoShift(dir,log).points,{});
    fs.writeFileSync(m.file,JSON.stringify({v:1,points:{bad:[2200,2200,2200],'D:comfort:base:2:1:1':[null,-1,Infinity]}}));
    assert.deepStrictEqual(new AutoShift(dir,log).points,{});
    console.log('PASS: automatic shifts learn, persist and predict separately; invalid shifts fall back; cold/manual limits and gear reset hold');
} finally {
    Date.now=now;
    fs.readdirSync(dir).forEach(name=>fs.unlinkSync(path.join(dir,name)));fs.rmdirSync(dir);
}
