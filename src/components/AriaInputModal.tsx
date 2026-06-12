import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Sparkles, Loader2, Keyboard, Play } from 'lucide-react';
import AriaConfirmationModal from './AriaConfirmationModal';
import { playSound, speak } from '@/lib/ariaVoice';

interface AriaInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  residentId: string;
  residentName: string;
  facilityId: string;
  onApproveVitals: (vitalsText: string, vitalsData: { temperature: number | null; systolic: number | null; diastolic: number | null }) => void;
}

export default function AriaInputModal({
  isOpen,
  onClose,
  residentId,
  residentName,
  facilityId,
  onApproveVitals
}: AriaInputModalProps) {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [recognitionError, setRecognitionError] = useState('');
  
  // Confirmation Modal states
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [parsedVitals, setParsedVitals] = useState<any>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-AU';

        rec.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          setInterimText(interimTranscript);
          if (finalTranscript) {
            setInputText(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + finalTranscript);
          }
        };

        rec.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setRecognitionError('Speech recognition issue. You can still type the values below.');
          setIsListening(false);
          playSound('error');
        };

        rec.onend = () => {
          setIsListening(false);
          setInterimText('');
        };

        recognitionRef.current = rec;
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      playSound('cancel');
    } else {
      setRecognitionError('');
      setParseError('');
      setIsListening(true);
      playSound('start');
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.error(err);
        setIsListening(false);
      }
    }
  };

  const handleParse = async () => {
    if (!inputText.trim()) return;
    setIsParsing(true);
    setParseError('');
    try {
      const res = await fetch('/api/aria/parse-vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          facilityId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to parse vitals');
      }

      setParsedVitals(data.vitals);
      setShowConfirmation(true);
      
      const speakParts = [];
      if (data.vitals?.temperature) speakParts.push(`temperature ${data.vitals.temperature} degrees`);
      if (data.vitals?.systolic && data.vitals?.diastolic) {
        speakParts.push(`blood pressure ${data.vitals.systolic} over ${data.vitals.diastolic}`);
      }
      if (speakParts.length > 0) {
        speak(`Vitals parsed. ${speakParts.join(' and ')}. Please verify.`);
      } else {
        speak("Vitals parsed. Please verify the values.");
      }
    } catch (err: any) {
      playSound('error');
      setParseError(err.message || 'Parser error. Please verify keys and connection.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmVitals = async (vitals: { temperature: number | null; systolic: number | null; diastolic: number | null }) => {
    let vitalsParts = [];
    if (vitals.temperature !== null) vitalsParts.push(`Temp: ${vitals.temperature}°C`);
    if (vitals.systolic !== null && vitals.diastolic !== null) vitalsParts.push(`BP: ${vitals.systolic}/${vitals.diastolic} mmHg`);
    
    const vitalsText = `Vitals recorded: ${vitalsParts.join(', ')}`;
    
    playSound('success');
    speak(`Vitals recorded successfully.`);
    onApproveVitals(vitalsText, vitals);
    
    setShowConfirmation(false);
    onClose();
  };
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/30 dark:bg-[#020617]/65 backdrop-blur-md p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 pointer-events-auto"
          onClick={onClose}
        ></div>

        {/* Modal Window */}
        <div className="relative w-full max-w-lg bg-surface backdrop-blur-2xl border border-border rounded-[32px] shadow-2xl p-6 sm:p-8 overflow-hidden z-10">
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Aria Speech-to-Vitals Parser
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                Dictate vitals for <strong className="text-text-primary font-bold">{residentName}</strong>
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors outline-none focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Instruction Banner */}
            <div className="bg-surface-solid/40 dark:bg-white/[0.01] border border-border-solid p-4 rounded-2xl text-xs text-text-secondary leading-relaxed">
              <p className="font-semibold text-text-primary mb-1">Example Statements:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>"Margaret has a temperature of thirty-eight point two and BP is 140 over 90"</li>
                <li>"Temp is thirty-seven point four and blood pressure felt high around 150 over 95"</li>
              </ul>
            </div>

            {/* Error banners */}
            {recognitionError && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs rounded-xl">
                {recognitionError}
              </div>
            )}
            {parseError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl">
                {parseError}
              </div>
            )}

            {/* Textarea Input */}
            <div className="space-y-2 relative">
              <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block pl-1">
                Dictated/Typed Notes
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Speak using the microphone or type clinical notes here..."
                className="w-full bg-white/30 dark:bg-black/25 border border-slate-200/50 dark:border-white/5 rounded-2xl p-4 text-sm focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 text-text-primary min-h-[120px] resize-none leading-relaxed transition-all"
              ></textarea>

              {/* Interim Text */}
              {isListening && interimText && (
                <div className="absolute inset-x-0 bottom-14 mx-4 bg-white/80 dark:bg-[#121214]/85 backdrop-blur-sm p-3 border border-border rounded-xl text-xs italic text-text-secondary animate-pulse">
                  {interimText}
                </div>
              )}

              {/* Recording indicator */}
              {isListening && (
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 pointer-events-none">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Listening...</span>
                </div>
              )}
            </div>

            {/* Mic trigger and parse controls */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={toggleListening}
                className={`flex-1 h-12 rounded-2xl border font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer outline-none focus:outline-none ${
                  isListening
                    ? 'bg-rose-500 border-transparent text-white shadow-lg shadow-rose-500/20 animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 border-border-solid text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-350'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4.5 h-4.5" />
                    <span>Stop Listening</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4.5 h-4.5" />
                    <span>Start Dictation</span>
                  </>
                )
                }
              </button>

              <button
                type="button"
                onClick={handleParse}
                disabled={isParsing || !inputText.trim()}
                className="flex-1 h-12 bg-gradient-to-r from-primary to-[#00C9A7] hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs tracking-wider uppercase rounded-2xl transition-all shadow-md shadow-primary/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer outline-none focus:outline-none"
              >
                {isParsing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Parse Vitals</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal overlay */}
      <AriaConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        rawText={inputText}
        residentName={residentName}
        initialVitals={parsedVitals}
        onConfirm={handleConfirmVitals}
      />
    </>
  );
}
