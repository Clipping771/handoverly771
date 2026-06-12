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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md transition-opacity duration-300"
          onClick={onClose}
        ></div>

        {/* Modal Window */}
        <div className="relative w-full max-w-lg bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200">
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                Aria Speech-to-Vitals Parser
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Dictate vitals for <strong className="text-slate-700 dark:text-slate-300">{residentName}</strong>
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Instruction Banner */}
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-150 dark:border-white/5 p-4 rounded-2xl text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p className="font-semibold text-slate-850 dark:text-slate-200 mb-1">Example Statements:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>"Margaret has a temperature of thirty-eight point two and BP is 140 over 90"</li>
                <li>"Temp is thirty-seven point four and blood pressure felt high around 150 over 95"</li>
              </ul>
            </div>

            {/* Error banners */}
            {recognitionError && (
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-400 text-xs rounded-xl">
                {recognitionError}
              </div>
            )}
            {parseError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-400 text-xs rounded-xl">
                {parseError}
              </div>
            )}

            {/* Textarea Input */}
            <div className="space-y-2 relative">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block pl-1">
                Dictated/Typed Notes
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Speak using the microphone or type clinical notes here..."
                className="w-full bg-slate-50 dark:bg-[#070a14] border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-indigo-55 focus:ring-4 focus:ring-indigo-500/10 text-slate-800 dark:text-white min-h-[120px] resize-none leading-relaxed"
              ></textarea>

              {/* Interim Text */}
              {isListening && interimText && (
                <div className="absolute inset-x-0 bottom-14 mx-4 bg-slate-100/90 dark:bg-[#121214]/90 backdrop-blur-sm p-3 border border-slate-200 dark:border-white/10 rounded-xl text-xs italic text-slate-600 dark:text-slate-350 animate-pulse">
                  {interimText}
                </div>
              )}

              {/* Recording indicator */}
              {isListening && (
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 pointer-events-none">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">Listening...</span>
                </div>
              )}
            </div>

            {/* Mic trigger and parse controls */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={toggleListening}
                className={`flex-1 h-12 rounded-xl border font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isListening
                    ? 'bg-rose-650 border-rose-650 text-white shadow-lg shadow-rose-600/20 animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 border-transparent text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
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
                className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs tracking-wider uppercase rounded-xl transition-all shadow-md shadow-indigo-600/25 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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
