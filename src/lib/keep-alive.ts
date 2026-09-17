/**
 * Keep-Alive Service
 *
 * Prevents browser tabs from being throttled, frozen, or discarded by the
 * browser's memory/power management while running in the background.
 *
 * Uses an inaudible, zero-volume Web Audio stream. For modern desktop & mobile
 * browsers (Chrome, Edge, Safari, Firefox), playing active media is the
 * standard signal that a tab must retain high execution priority (regular
 * setInterval timers, no background freezing).
 *
 * Does NOT use screen wake-lock (display is free to dim/sleep normally).
 */

const STORAGE_KEY = "lifeCalendar:keepAliveEnabled";

class KeepAliveManager {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private isRunning = false;

  public isSupported(): boolean {
    return typeof window !== "undefined" && ("AudioContext" in window || "webkitAudioContext" in window);
  }

  public isEnabled(): boolean {
    try {
      // Enabled by default so users stay continuously synced in background
      const val = localStorage.getItem(STORAGE_KEY);
      return val === null ? true : val === "true";
    } catch {
      return true;
    }
  }

  public setEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      /* non-fatal */
    }
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  public start(): void {
    if (this.isRunning || !this.isSupported() || !this.isEnabled()) return;

    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      this.ctx = new AudioContextClass();
      // Gain node with absolute 0 volume — entirely silent
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.00001; // Tiny non-zero value prevents some browsers from optimizing it out

      // Mute completely before destination
      const zeroGain = this.ctx.createGain();
      zeroGain.gain.value = 0;
      this.gain.connect(zeroGain);
      zeroGain.connect(this.ctx.destination);

      // Low frequency oscillator (1 Hz) for ultra-minimal CPU overhead (< 0.01%)
      this.osc = this.ctx.createOscillator();
      this.osc.frequency.value = 1;
      this.osc.connect(this.gain);
      this.osc.start();

      if (this.ctx.state === "suspended") {
        // May be suspended initially until first user interaction; auto-resume on click/keydown
        const resume = () => {
          if (this.ctx && this.ctx.state === "suspended") {
            void this.ctx.resume();
          }
          window.removeEventListener("click", resume);
          window.removeEventListener("keydown", resume);
          window.removeEventListener("touchstart", resume);
        };
        window.addEventListener("click", resume, { once: true, passive: true });
        window.addEventListener("keydown", resume, { once: true, passive: true });
        window.addEventListener("touchstart", resume, { once: true, passive: true });
      }

      this.isRunning = true;
    } catch (err) {
      console.warn("[keep-alive] unable to start background audio stream:", err);
    }
  }

  public stop(): void {
    if (!this.isRunning) return;
    try {
      if (this.osc) {
        this.osc.stop();
        this.osc.disconnect();
        this.osc = null;
      }
      if (this.gain) {
        this.gain.disconnect();
        this.gain = null;
      }
      if (this.ctx) {
        void this.ctx.close();
        this.ctx = null;
      }
    } catch {
      /* non-fatal */
    } finally {
      this.isRunning = false;
    }
  }
}

export const keepAlive = new KeepAliveManager();
