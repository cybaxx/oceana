class Conf {
    roughness = 0.4;
    metalness = 0.2;
    transmission = 0.7;
    color = 0xffffff;
    iridescence = 0.0;
    iridescenceIOR = 2.33;

    runSimulation = true;
    showVerletSprings = false;

    _onFpsUpdate = null;
    _frames = 0;
    _lastTime = performance.now();
    _beginTime = 0;

    constructor() {}

    set onFpsUpdate(cb) {
        this._onFpsUpdate = cb;
    }

    init() {}

    update() {}

    begin() {
        this._beginTime = performance.now();
    }

    end() {
        this._frames++;
        const now = performance.now();
        if (now - this._lastTime >= 1000) {
            const fps = Math.round((this._frames * 1000) / (now - this._lastTime));
            this._frames = 0;
            this._lastTime = now;
            if (this._onFpsUpdate) this._onFpsUpdate(fps);
        }
    }
}
export const conf = new Conf();
