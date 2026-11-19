'use strict';
const fs = require('fs');
const path = require('path');
const num = (v) => typeof v === 'number' && isFinite(v);
const median = (xs) => xs.slice().sort((a, b) => a - b)[1];

class AutoShift {
    constructor(dataDir, log) {
        this.file = path.join(dataDir || '.', 'auto_shift.json');
        this.log = log;
        this.points = {};
        this.reset();
        try {
            const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
            if (saved.v === 1) Object.keys(saved.points || {}).forEach((key) => {
                const xs = saved.points[key];
                if (/^[DS]:(comfort|sport|eco):(base|plus|individual):[012]:[1-9]:[012]$/.test(key) &&
                    Array.isArray(xs) && xs.length <= 3 && xs.every((v) => num(v) && v >= 1200 && v <= 10000)) this.points[key] = xs;
            });
        } catch (e) { /* no usable history yet */ }
    }

    reset() { this.samples = []; this.context = null; this.gear = null; this.at = null; this.key = null; }

    contextOf(d, o) {
        if (!o.autoFollow || o.testing || d.demo || d.gearGuessed || !['D', 'S'].includes(o.mode) ||
            !['comfort', 'sport', 'eco'].includes(o.drive) || (d.stage && d.stage !== 'D') ||
            !Number.isInteger(d.gear) || d.gear < 1 || d.gear > 9 || !num(d.speed) || d.speed < 5 ||
            !num(d.rpm) || d.rpm < 600 || d.rpm > o.redline + 200 || !num(d.oil)) return null;
        return [o.mode, o.drive, o.variant || 'base', d.oil < 60 ? 0 : d.oil < 80 ? 1 : 2].join(':');
    }

    sample(d, t, o) {
        const context = this.contextOf(d, o);
        if (!context || !num(t)) { this.reset(); return; }
        if (context !== this.context || this.at === null || t < this.at || t - this.at > 750) this.reset();
        if (this.gear !== null && d.gear !== this.gear) {
            if (d.gear === this.gear + 1) {
                const recent = this.samples.filter((s) => t - s.t <= 600);
                const peak = recent.reduce((a, b) => !a || b.rpm >= a.rpm ? b : a, null);
                if (peak && peak.key && peak.rpm >= 1200 && peak.rpm <= o.redline && t - peak.t <= 350) {
                    const xs = (this.points[peak.key] || []).concat([Math.round(peak.rpm)]).slice(-3);
                    this.points[peak.key] = xs;
                    try {
                        fs.writeFileSync(this.file + '.tmp', JSON.stringify({ v: 1, points: this.points }));
                        fs.renameSync(this.file + '.tmp', this.file);
                    } catch (e) { this.log.warn('auto shift: cannot save history (' + e.message + ')'); }
                    this.log.info('auto shift: ' + peak.key + ' @' + Math.round(peak.rpm) + ' (' + xs.length + '/3)');
                }
            }
            this.samples = [];
        }
        this.context = context; this.gear = d.gear; this.at = t;
        this.samples = this.samples.filter((s) => t - s.t <= 600).slice(-79);
        const start = this.samples.find((s) => t - s.t >= 200);
        const rate = start ? (d.rpm - start.rpm) * 1000 / (t - start.t) : 0;
        // shortcut: RPM rise groups approximate load; use a verified pedal signal if available later.
        this.key = rate >= 100 ? context + ':' + d.gear + ':' + (rate < 500 ? 0 : rate < 1500 ? 1 : 2) : null;
        this.samples.push({ t, rpm: d.rpm, key: this.key });
    }

    point(d, o, now) {
        if (this.contextOf(d, o) !== this.context || !this.context || d.gear !== this.gear ||
            now < this.at || now - this.at > 750) return null;
        const xs = this.points[this.key];
        if (!xs || xs.length !== 3) return null;
        const rpm = median(xs);
        if (Math.max.apply(null, xs) - Math.min.apply(null, xs) > Math.max(300, rpm * 0.15)) return null;
        return Math.min(rpm, o.redline);
    }
}

module.exports = AutoShift;
