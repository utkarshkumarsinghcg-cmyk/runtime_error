/**
 * tts.js
 * 
 * Text-to-Speech client-side wrapper utilizing the Web Speech API's SpeechSynthesis.
 * Adapted from read-aloud references (MIT).
 */

export class TTSController {
  constructor() {
    this.synth = window.speechSynthesis;
    this.utterance = null;
    this.isPlaying = false;
    this.queue = [];
    this.currentIndex = 0;
  }

  speak(text, onBoundary, onEnd, onError) {
    this.stop();
    
    if (!text) return;
    
    this.utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice properties
    this.utterance.rate = 1.0;
    this.utterance.pitch = 1.0;
    
    this.utterance.onboundary = (event) => {
      if (onBoundary) onBoundary(event);
    };

    this.utterance.onend = (event) => {
      this.isPlaying = false;
      if (onEnd) onEnd(event);
    };

    this.utterance.onerror = (event) => {
      this.isPlaying = false;
      if (onError) onError(event);
    };

    this.isPlaying = true;
    this.synth.speak(this.utterance);
  }

  pause() {
    if (this.synth && this.isPlaying) {
      this.synth.pause();
    }
  }

  resume() {
    if (this.synth && this.isPlaying) {
      this.synth.resume();
    }
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.isPlaying = false;
    }
  }
}
