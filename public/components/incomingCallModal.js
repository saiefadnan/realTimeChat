(function () {
  let _overlay = null;
  let _ringtone = null;
  let _resolved = false;

  // ── Web Audio ringtone (phone‑like pattern) ──────────────────────────
  class Ringtone {
    constructor() {
      this.ctx = null;
      this._playing = false;
      this._timeout = null;
    }

    start() {
      if (this._playing) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) {
        return;
      }
      this._playing = true;
      this._schedule();
    }

    stop() {
      this._playing = false;
      if (this._timeout) {
        clearTimeout(this._timeout);
        this._timeout = null;
      }
      if (this.ctx && this.ctx.state !== "closed") {
        this.ctx.close();
      }
      this.ctx = null;
    }

    _schedule() {
      if (!this._playing || !this.ctx) return;
      const now = this.ctx.currentTime;

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.value = 440;
      osc2.type = "sine";
      osc2.frequency.value = 480;

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      // 0.4s ring, 0.2s pause, 0.4s ring, 2s pause
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.setValueAtTime(0.25, now + 0.4);
      gain.gain.linearRampToValueAtTime(0, now + 0.45);
      gain.gain.setValueAtTime(0, now + 0.6);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.62);
      gain.gain.setValueAtTime(0.25, now + 1.0);
      gain.gain.linearRampToValueAtTime(0, now + 1.05);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.1);
      osc2.stop(now + 1.1);

      this._timeout = setTimeout(() => this._schedule(), 3100);
    }
  }

  // ── Escape helper ────────────────────────────────────────────────────
  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Create overlay ───────────────────────────────────────────────────
  function buildOverlay({ callerName, roomName, onAccept, onReject }) {
    const overlay = document.createElement("div");
    overlay.id = "incoming-call-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Incoming video call");

    const sheet = document.createElement("style");
    sheet.textContent =
      "#incoming-call-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);animation:icFadeIn .25s ease}#incoming-call-overlay .ic-card{background:#151921;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:40px 48px 32px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5);max-width:380px;width:90%;animation:icSlideUp .3s ease}#incoming-call-overlay .ic-avatar{width:72px;height:72px;border-radius:50%;background:#00d26a;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:32px;color:#0b0e14}#incoming-call-overlay .ic-label{font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}#incoming-call-overlay .ic-caller{font-size:22px;font-weight:700;color:#e2e8f0;margin-bottom:4px}#incoming-call-overlay .ic-room{font-size:14px;color:#64748b;margin-bottom:28px}#incoming-call-overlay .ic-actions{display:flex;gap:24px;justify-content:center}#incoming-call-overlay .ic-btn{width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:24px;transition:transform .15s,box-shadow .15s;color:#fff}#incoming-call-overlay .ic-btn:hover{transform:scale(1.1)}#incoming-call-overlay .ic-btn:active{transform:scale(.95)}#incoming-call-overlay .ic-btn-accept{background:#00d26a;box-shadow:0 4px 16px rgba(0,210,106,.35)}#incoming-call-overlay .ic-btn-accept:hover{box-shadow:0 6px 24px rgba(0,210,106,.5)}#incoming-call-overlay .ic-btn-reject{background:#ef4444;box-shadow:0 4px 16px rgba(239,68,68,.35)}#incoming-call-overlay .ic-btn-reject:hover{box-shadow:0 6px 24px rgba(239,68,68,.5)}@keyframes icFadeIn{from{opacity:0}to{opacity:1}}@keyframes icSlideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}";

    overlay.appendChild(sheet);

    overlay.innerHTML += `
      <div class="ic-card">
        <div class="ic-avatar">
          <i class="material-icons">phone</i>
        </div>
        <div class="ic-label">Incoming Call</div>
        <div class="ic-caller">${esc(callerName)}</div>
        <div class="ic-room">in <strong>${esc(roomName)}</strong></div>
        <div class="ic-actions">
          <button class="ic-btn ic-btn-reject" id="ic-reject" title="Decline">
            <i class="material-icons">call_end</i>
          </button>
          <button class="ic-btn ic-btn-accept" id="ic-accept" title="Accept">
            <i class="material-icons">call</i>
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    overlay.querySelector("#ic-accept").addEventListener("click", () => {
      if (_resolved) return;
      _resolved = true;
      destroy();
      onAccept();
    });

    overlay.querySelector("#ic-reject").addEventListener("click", () => {
      if (_resolved) return;
      _resolved = true;
      destroy();
      onReject();
    });

    return overlay;
  }

  function destroy() {
    if (_ringtone) {
      _ringtone.stop();
      _ringtone = null;
    }
    if (_overlay) {
      _overlay.remove();
      _overlay = null;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────
  window.incomingCall = function incomingCall({
    callerName = "Someone",
    roomName = "",
    timeout = 30000,
  } = {}) {
    // Close any existing modal first
    if (_overlay) destroy();
    _resolved = false;

    return new Promise((resolve) => {
      _ringtone = new Ringtone();
      _ringtone.start();

      _overlay = buildOverlay({
        callerName,
        roomName,
        onAccept: () => resolve({ accepted: true, timedOut: false }),
        onReject: () => resolve({ accepted: false, timedOut: false }),
      });

      let timer = null;
      if (timeout > 0) {
        timer = setTimeout(() => {
          if (_resolved) return;
          _resolved = true;
          destroy();
          resolve({ accepted: false, timedOut: true });
        }, timeout);
      }

      // Expose a manual close for external cleanup (page transition, etc.)
      window.incomingCallClose = () => {
        if (_resolved) return;
        _resolved = true;
        if (timer) clearTimeout(timer);
        destroy();
        resolve({ accepted: false, timedOut: true });
      };
    });
  };
})();
