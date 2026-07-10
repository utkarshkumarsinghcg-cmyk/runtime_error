/**
 * stt.js
 * 
 * Speech-to-Text client-side controller. Handles audio capture, Web Speech API SpeechRecognition,
 * and transcription dispatch.
 */

export class STTController {
  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Web Speech API (SpeechRecognition) is not supported in this browser.');
      this.recognition = null;
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
  }

  start(onResult, onEnd, onError) {
    if (!this.recognition) {
      if (onError) onError(new Error('SpeechRecognition not supported'));
      return;
    }

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (onResult) {
        onResult({
          interim: interimTranscript,
          final: finalTranscript,
          isFinal: finalTranscript.length > 0
        });
      }
    };

    this.recognition.onend = () => {
      if (onEnd) onEnd();
    };

    this.recognition.onerror = (event) => {
      if (onError) onError(event);
    };

    try {
      this.recognition.start();
    } catch (err) {
      console.warn('STT start warning:', err);
    }
  }

  stop() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('STT stop warning:', err);
      }
    }
  }
}
