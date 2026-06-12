'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import AriaInputModal from './AriaInputModal';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { playSound, speak } from '@/lib/ariaVoice';

interface AriaFloatingButtonProps {
  selectedResidentId: string | null;
  residents: Array<{ id: string; name: string }>;
  facilityId: string;
  onVitalsRecorded?: () => void;
}

type GestureState = 'IDLE' | 'PRESSING' | 'RECORDING';

export default function AriaFloatingButton({
  selectedResidentId,
  residents,
  facilityId,
  onVitalsRecorded
}: AriaFloatingButtonProps) {
  const [gestureState, setGestureState] = useState<GestureState>('IDLE');
  const [progress, setProgress] = useState(0);
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcribedTextRef = useRef<string>('');
  
  const [showDirectConfirmation, setShowDirectConfirmation] = useState(false);
  const [directRawText, setDirectRawText] = useState('');
  const [directParsedVitals, setDirectParsedVitals] = useState<any>(null);
  const [isParsingDirect, setIsParsingDirect] = useState(false);

  const activeResident = residents.find(r => r.id === selectedResidentId);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-AU';

        rec.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          transcribedTextRef.current = text;
          setDirectRawText(text);
        };

        rec.onerror = (event: any) => {
          console.error('Speech recognition error during hold:', event.error);
          playSound('error');
          toast.error('Voice recording issue. Please try typing instead.');
        };

        rec.onend = () => {
          setGestureState('IDLE');
          setProgress(0);
          handleSpeechFinished();
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const handleSpeechFinished = async () => {
    const speechText = transcribedTextRef.current.trim();
    if (!speechText) {
      playSound('cancel');
      toast.error('No speech detected. Please try again.');
      return;
    }

    if (!selectedResidentId) {
      playSound('error');
      toast.error('No resident selected for the recording.');
      return;
    }

    setIsParsingDirect(true);
    toast.loading('Parsing vitals...', { id: 'parsing-vitals' });
    try {
      const res = await fetch('/api/aria/parse-vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: speechText,
          facilityId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse');

      setDirectParsedVitals(data.vitals);
      setShowDirectConfirmation(true);
      toast.success('Vitals parsed successfully.', { id: 'parsing-vitals' });
      
      const speakParts = [];
      if (data.vitals?.temperature) speakParts.push(`temperature ${data.vitals.temperature} degrees`);
      if (data.vitals?.systolic && data.vitals?.diastolic) {
        speakParts.push(`blood pressure ${data.vitals.systolic} over ${data.vitals.diastolic}`);
      }
      if (speakParts.length > 0) {
        speak(`Vitals parsed. ${speakParts.join(' and ')}. Please verify and confirm.`);
      } else {
        speak("Vitals parsed. Please verify the values.");
      }
    } catch (err: any) {
      console.error(err);
      playSound('error');
      toast.error('Clinical parser failed. Opening manual input.', { id: 'parsing-vitals' });
      setIsInputModalOpen(true);
    } finally {
      setIsParsingDirect(false);
    }
  };

  const startPressTimer = (clientX: number, clientY: number) => {
    if (gestureState !== 'IDLE') return;

    if (!selectedResidentId) {
      playSound('error');
      toast.error('Please select a resident first to record vitals.');
      return;
    }

    startPosRef.current = { x: clientX, y: clientY };
    setGestureState('PRESSING');
    setProgress(0);

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const percentage = Math.min((elapsed / 500) * 100, 100);
      setProgress(percentage);
      if (percentage >= 100) {
        clearInterval(progressIntervalRef.current!);
      }
    }, 16);

    pressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      setGestureState('RECORDING');
      transcribedTextRef.current = '';
      try {
        playSound('start');
        recognitionRef.current?.start();
        toast.success(`Recording vitals for ${activeResident?.name}...`, { icon: '🎙️', duration: 3000 });
      } catch (err) {
        console.error('Speech start error:', err);
      }
    }, 500);
  };

  const cancelPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgress(0);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    (e.target as HTMLButtonElement).releasePointerCapture(e.pointerId);
    startPressTimer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (gestureState !== 'PRESSING') return;
    if (!startPosRef.current) return;

    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 10) {
      cancelPress();
      setGestureState('IDLE');
      playSound('cancel');
      toast.error('Gesture cancelled (moved too far)');
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (gestureState === 'PRESSING') {
      cancelPress();
      setGestureState('IDLE');
      setIsInputModalOpen(true);
    } else if (gestureState === 'RECORDING') {
      try {
        recognitionRef.current?.stop();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleConfirmDirectVitals = async (vitals: { temperature: number | null; systolic: number | null; diastolic: number | null }) => {
    if (!selectedResidentId) return;

    try {
      const { data: userSession } = await supabase.auth.getSession();
      const staffId = userSession?.session?.user?.id;
      const todayStr = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('handovers')
        .insert({
          resident_id: selectedResidentId,
          facility_id: facilityId,
          staff_id: staffId,
          shift_date: todayStr,
          raw_input: directRawText,
          rn_summary: {
            vitals: {
              temperature: vitals.temperature,
              bp: {
                systolic: vitals.systolic,
                diastolic: vitals.diastolic
              }
            }
          },
          urgency: (vitals.temperature && vitals.temperature > 38.5) || (vitals.systolic && vitals.systolic >= 140) ? 'critical' : 'routine',
          is_approved: true
        });

      if (error) throw error;

      playSound('success');
      speak(`Vitals recorded successfully for ${activeResident?.name || 'resident'}`);
      toast.success('Vitals recorded successfully!');
      if (onVitalsRecorded) onVitalsRecorded();
    } catch (e: any) {
      console.error(e);
      playSound('error');
      toast.error('Failed to save vitals: ' + e.message);
    }
  };

  return (
    <>
      <style>{`
        @keyframes waveform-bar {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
        .animate-waveform-bar-1 { animation: waveform-bar 0.5s ease-in-out infinite; transform-origin: center; }
        .animate-waveform-bar-2 { animation: waveform-bar 0.5s ease-in-out infinite 0.1s; transform-origin: center; }
        .animate-waveform-bar-3 { animation: waveform-bar 0.5s ease-in-out infinite 0.2s; transform-origin: center; }
        .animate-waveform-bar-4 { animation: waveform-bar 0.5s ease-in-out infinite 0.3s; transform-origin: center; }
        .animate-waveform-bar-5 { animation: waveform-bar 0.5s ease-in-out infinite 0.4s; transform-origin: center; }
      `}</style>

      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center">
        {gestureState === 'RECORDING' && (
          <div className="mb-3 bg-red-600/90 text-white text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-full shadow-lg flex items-center gap-3 animate-pulse">
            <div className="flex items-center gap-1 h-3.5 w-6">
              <span className="w-0.5 h-full bg-white rounded-full animate-waveform-bar-1"></span>
              <span className="w-0.5 h-full bg-white rounded-full animate-waveform-bar-2"></span>
              <span className="w-0.5 h-full bg-white rounded-full animate-waveform-bar-3"></span>
              <span className="w-0.5 h-full bg-white rounded-full animate-waveform-bar-4"></span>
              <span className="w-0.5 h-full bg-white rounded-full animate-waveform-bar-5"></span>
            </div>
            <span>Recording Voice...</span>
          </div>
        )}

        <button
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`relative w-[56px] h-[56px] rounded-full flex items-center justify-center transition-all duration-300 shadow-xl select-none outline-none ${
            gestureState === 'RECORDING'
              ? 'bg-[#E8445A] scale-110 text-white ring-4 ring-red-500/30'
              : gestureState === 'PRESSING'
                ? 'bg-slate-700 scale-95 text-white'
                : 'bg-[#00C9A7] hover:bg-[#00bda0] text-white hover:scale-105 active:scale-95'
          }`}
          title="Aria Voice Assistant (Tap to type, Hold to speak)"
          type="button"
        >
          {gestureState === 'PRESSING' && (
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="28"
                cy="28"
                r="26"
                stroke="white"
                strokeWidth="3"
                fill="transparent"
                strokeDasharray="163"
                strokeDashoffset={163 - (163 * progress) / 100}
                className="transition-all duration-75"
              />
            </svg>
          )}

          {gestureState === 'RECORDING' ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>
      </div>

      {isInputModalOpen && selectedResidentId && activeResident && (
        <AriaInputModal
          isOpen={isInputModalOpen}
          onClose={() => setIsInputModalOpen(false)}
          residentId={selectedResidentId}
          residentName={activeResident.name}
          facilityId={facilityId}
          onApproveVitals={async (vitalsText, vitalsData) => {
            await handleConfirmDirectVitals(vitalsData);
            if (onVitalsRecorded) onVitalsRecorded();
          }}
        />
      )}

      {showDirectConfirmation && activeResident && (
        <AriaInputModal
          isOpen={showDirectConfirmation}
          onClose={() => setShowDirectConfirmation(false)}
          residentId={selectedResidentId!}
          residentName={activeResident.name}
          facilityId={facilityId}
          onApproveVitals={async (vitalsText, vitalsData) => {
            await handleConfirmDirectVitals(vitalsData);
            if (onVitalsRecorded) onVitalsRecorded();
          }}
        />
      )}
    </>
  );
}
