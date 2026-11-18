'use strict';
/**
 * vehicle_state.js - HUD switch-off guard, after cauliflowermossgrape's Redline (MIT).
 * The HUD stops drawing while the car powers down. The panel stays wanted while the cluster is awake;
 * cluster-render >= 0.6.4 reconnects it after display drops without the old mapping-strike counter.
 * Unknown vehicle states still hold new layers on either target. For the HUD:
 *   - no NEW layer is made while BMW's vehicle state is 5 or lower (off / parked / living), 8 (drive readiness
 *     starting) or 12 (drive readiness ending), or is a state we don't know (15 "no value" among them: the last known
 *     one may be stale);
 *   - layers already up are dropped at 12 or 5 and lower, so cluster-render (and our client's replay after a
 *     reconnect) has nothing to map again as the cluster goes; at 8 or an unknown state they stay;
 *   - when the state is back to normal (7 ignition on, 10 drive-ready) the layout is built again.
 * A car (or the bench) that never sends the state is not held back at all, as before this guard; that is logged once.
 *
 * The state: de.bmw.infrastructure.VehicleCondition / VehicleCondition.statusConditionVehicle, names or wire numbers
 * (kit/runtime/car.js conditionOf: 1 PARKEN_BN_NIO, 2 PARKEN_BN_IO, 3 STANDFUNKTIONEN_KUNDE_NICHT_IM_FZG, 5 WOHNEN,
 * 7 PRUEFEN_ANALYSE_DIAGNOSE, 8 FAHRBEREITSCHAFT_HERSTELLEN, 10 FAHREN, 12 FAHRBEREITSCHAFT_BEENDEN).
 *
 *   const vs = new VehicleState(log, onChange, target)   // target: hud (default) or panel
 *   extra['de.bmw.infrastructure.VehicleCondition'] = { VehicleCondition: (v) => vs.feed(v) }
 *   vs.hold()  -> true: make no new layer now          vs.drop() -> true: drop the layers that are up
 *   vs.text()  -> "vehicle state 12" for the status line
 * Plain Node 8 (the car's 8.16.2). Never throws out of feed().
 */
const Car = require('./kit/car');

const NOT_SEEN_LOG_MS = 30000;   // no state by then: say once that nothing is held back
const isNum = (v) => typeof v === 'number' && isFinite(v);

class VehicleState {
    constructor(log, onChange, target = 'hud') {
        this.log = log;
        this.target = target;
        this.onChange = onChange || (() => {});
        this.state = undefined;      // the last KNOWN state (number)
        this.known = null;           // null: nothing sent yet; false: the last one sent isn't a state we know
        this.raw = null;
        this.seen = [];              // raw values logged so far (each once)
        this.was = this._key();
        this.timer = setTimeout(() => {
            if (this.known === null) this.log.info('vehicle state: not seen (bench, or a car that does not send it); layers are not held back at switch-off');
        }, NOT_SEEN_LOG_MS);
        if (this.timer.unref) this.timer.unref();
    }

    /** One VehicleCondition notification. */
    feed(v) {
        try {
            const raw = v && v.statusConditionVehicle;
            if (raw === undefined || raw === null) return;
            const n = Car.conditionOf ? Car.conditionOf(raw) : (isNum(raw) ? raw : undefined);
            if (this.seen.length < 16 && this.seen.indexOf(String(raw)) < 0) {
                this.seen.push(String(raw));
                this.log.info('vehicle state: ' + JSON.stringify(raw) + (n === undefined ? ' (not known: no new layer while it lasts)' : ''));
            }
            this.raw = raw;
            this.known = n !== undefined;
            if (n !== undefined) this.state = n;
            const k = this._key();
            if (k !== this.was) {
                const before = this.was;
                this.was = k;
                this.log.info('vehicle state ' + this.text() + ': ' + (this.drop() ? 'layers dropped (the car is switching off)'
                    : this.hold() ? 'no new layer until the car is on' : 'layers allowed') + ' (was ' + before + ')');
                this.onChange();
            }
        } catch (e) { this.log.warn('vehicle state: ' + (e && e.message || e)); }
    }

    /** No new layer now: off / parked (5 and lower), drive readiness starting (8) or ending (12), or a state we don't know. */
    hold() {
        const c = this.state;
        return this.known === false || (this.target !== 'panel' && isNum(c) && (c <= 5 || c === 8 || c === 12));
    }
    /** Drop what is up: drive readiness ending (12) or off (5 and lower), by the last known state (as Redline). */
    drop() {
        const c = this.state;
        return this.target !== 'panel' && isNum(c) && (c <= 5 || c === 12);
    }
    text() { return this.known === false ? JSON.stringify(this.raw) + ' (not known)' : isNum(this.state) ? String(this.state) : 'not seen'; }
    _key() { return this.drop() ? 'drop' : this.hold() ? 'hold' : 'free'; }
    stop() { clearTimeout(this.timer); }
}

module.exports = VehicleState;
