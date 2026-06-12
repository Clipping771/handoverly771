let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playSound(type: 'start' | 'success' | 'cancel' | 'error') {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;

  if (type === 'start') {
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.08, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    
    osc1.start(now);
    osc1.stop(now + 0.15);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.08); // D6
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.08, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    
    osc2.start(now + 0.08);
    osc2.stop(now + 0.22);
  } else if (type === 'success') {
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 chord
    freqs.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      gain.gain.setValueAtTime(0, now + index * 0.04);
      gain.gain.linearRampToValueAtTime(0.04, now + index * 0.04 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.04 + 0.3);
      
      osc.start(now + index * 0.04);
      osc.stop(now + index * 0.04 + 0.4);
    });
  } else if (type === 'cancel') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(392, now); // G4
    osc.frequency.exponentialRampToValueAtTime(196, now + 0.15); // G3
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'error') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now); // C3 low buzz
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.35);
  }
}

export function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-AU';
  utterance.rate = 1.05;
  utterance.pitch = 1.15;

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => 
    v.lang.startsWith('en-AU') || v.lang.startsWith('en-GB') || v.lang.startsWith('en-US')
  );
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.speak(utterance);
}
