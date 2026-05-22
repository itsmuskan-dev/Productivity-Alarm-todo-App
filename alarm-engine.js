/**
 * Advanced Web Audio API Engine.
 * Synthesizes high-priority, looping audio signals programmatically,
 * satisfying PWA requirements and bypassing asset dependency issues.
 */
const AlarmAudioEngine = {
    audioCtx: null,
    oscillator: null,
    gainNode: null,
    intervalId: null,
    isPlaying: false,
    customAudioBuffer: null,
    customSource: null,

    init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    async setCustomAudio(file) {
        this.init();
        const reader = new FileReader();
        return new Promise((resolve) => {
            reader.onload = async (e) => {
                try {
                    this.customAudioBuffer = await this.audioCtx.decodeAudioData(e.target.result);
                    resolve(true);
                } catch (err) {
                    console.error("Failed to parse custom audio binary file", err);
                    resolve(false);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    },

    start(toneProfile) {
        this.init();
        if (this.isPlaying) return;
        this.isPlaying = true;

        if (toneProfile === 'custom' && this.customAudioBuffer) {
            this.playCustomBufferLoop();
        } else {
            this.playSynthesizedTone(toneProfile);
        }
    },

    playSynthesizedTone(profile) {
        const runPulse = () => {
            if (!this.isPlaying) return;

            this.oscillator = this.audioCtx.createOscillator();
            this.gainNode = this.audioCtx.createGain();

            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.audioCtx.destination);

            if (profile === 'nuclear-siren') {
                this.oscillator.type = 'sawtooth';
                this.oscillator.frequency.setValueAtTime(880, this.audioCtx.currentTime);
                this.oscillator.frequency.linearRampToValueAtTime(440, this.audioCtx.currentTime + 0.4);
            } else {
                // Default: synth-pulse
                this.oscillator.type = 'sine';
                this.oscillator.frequency.setValueAtTime(1200, this.audioCtx.currentTime);
            }

            this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
            this.gainNode.gain.linearRampToValueAtTime(0.8, this.audioCtx.currentTime + 0.05);
            this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.45);

            this.oscillator.start();
            this.oscillator.stop(this.audioCtx.currentTime + 0.5);
        };

        runPulse();
        this.intervalId = setInterval(runPulse, 600);
    },

    playCustomBufferLoop() {
        const loopSource = () => {
            if (!this.isPlaying) return;
            this.customSource = this.audioCtx.createBufferSource();
            this.customSource.buffer = this.customAudioBuffer;
            this.customSource.connect(this.audioCtx.destination);
            this.customSource.start(0);
            
            this.customSource.onended = () => {
                if (this.isPlaying) loopSource();
            };
        };
        loopSource();
    },

    stop() {
        this.isPlaying = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.oscillator) {
            try { this.oscillator.stop(); } catch(e){}
        }
        if (this.customSource) {
            try { this.customSource.stop(); } catch(e){}
        }
    }
};