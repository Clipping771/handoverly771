import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Check, HelpCircle, AlertTriangle } from 'lucide-react';

interface AriaConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawText: string;
  residentName: string;
  initialVitals: {
    temperature: { value: number | null; confidence: 'high' | 'low' };
    bp: { systolic: number | null; diastolic: number | null; confidence: 'high' | 'low' };
  };
  onConfirm: (vitals: {
    temperature: number | null;
    systolic: number | null;
    diastolic: number | null;
  }) => Promise<void>;
}

export default function AriaConfirmationModal({
  isOpen,
  onClose,
  rawText,
  residentName,
  initialVitals,
  onConfirm
}: AriaConfirmationModalProps) {
  const [temperature, setTemperature] = useState<string>('');
  const [systolic, setSystolic] = useState<string>('');
  const [diastolic, setDiastolic] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTemperature(initialVitals.temperature.value !== null ? initialVitals.temperature.value.toString() : '');
      setSystolic(initialVitals.bp.systolic !== null ? initialVitals.bp.systolic.toString() : '');
      setDiastolic(initialVitals.bp.diastolic !== null ? initialVitals.bp.diastolic.toString() : '');
    }
  }, [isOpen, initialVitals]);

  if (!isOpen) return null;

  const parsedTemp = parseFloat(temperature);
  const parsedSystolic = parseInt(systolic);
  const parsedDiastolic = parseInt(diastolic);

  // Clinical threshold checks
  const isFever = !isNaN(parsedTemp) && parsedTemp > 38.5;
  const isHypothermia = !isNaN(parsedTemp) && parsedTemp < 35.0;
  const isHypertension = (!isNaN(parsedSystolic) && parsedSystolic >= 140) || (!isNaN(parsedDiastolic) && parsedDiastolic >= 90);
  const isHypotension = (!isNaN(parsedSystolic) && parsedSystolic < 90) || (!isNaN(parsedDiastolic) && parsedDiastolic < 60);

  const hasClinicalAlert = isFever || isHypothermia || isHypertension || isHypotension;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm({
        temperature: temperature ? parseFloat(temperature) : null,
        systolic: systolic ? parseInt(systolic) : null,
        diastolic: diastolic ? parseInt(diastolic) : null
      });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-slate-500/10 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
              Aria Voice Confirmation Gate
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Verify clinical vitals for <strong className="text-slate-700 dark:text-slate-300">{residentName}</strong>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Raw Transcribed Text */}
          <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Spoken Note Transcription</span>
            <p className="text-sm italic text-slate-700 dark:text-slate-300">
              "{rawText}"
            </p>
          </div>

          {/* Ambiguous Input Warnings */}
          {(initialVitals.temperature.confidence === 'low' || initialVitals.bp.confidence === 'low') && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl">
              <HelpCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide">Ambiguous Voice Input Detected</h4>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Some spoken terms were flagged as tentative or low confidence. Please verify all fields carefully.
                </p>
              </div>
            </div>
          )}

          {/* Clinical Alert Warning Banner */}
          {hasClinicalAlert && (
            <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl animate-pulse">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wide">Critical Vitals Warning</h4>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                  {isFever && "• Temperature indicates FEVER (>38.5°C). "}
                  {isHypothermia && "• Temperature indicates HYPOTHERMIA (<35.0°C). "}
                  {isHypertension && "• Blood Pressure indicates HYPERTENSION (>=140/90). "}
                  {isHypotension && "• Blood Pressure indicates HYPOTENSION (<90/60). "}
                </p>
              </div>
            </div>
          )}

          {/* Extracted Values Fields */}
          <div className="grid grid-cols-2 gap-4">
            {/* Temperature Field */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block pl-1">
                Temperature (°C)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className={`w-full h-12 bg-white dark:bg-[#070a14] border rounded-xl px-4 text-sm font-bold focus:outline-none transition-all ${
                    isFever || isHypothermia 
                      ? 'border-rose-400 focus:border-rose-500 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-50/25 dark:bg-rose-500/5' 
                      : initialVitals.temperature.confidence === 'low' 
                        ? 'border-amber-400 focus:border-amber-500 text-amber-600' 
                        : 'border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:border-slate-400 dark:focus:border-slate-500'
                  }`}
                  placeholder="e.g. 37.0"
                />
                {initialVitals.temperature.confidence === 'low' && (
                  <span className="absolute right-3 top-3 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 rounded-md font-bold">
                    Low Conf
                  </span>
                )}
              </div>
            </div>

            {/* Blood Pressure Fields */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block pl-1">
                BP (Systolic / Diastolic)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value)}
                    className={`w-full h-12 bg-white dark:bg-[#070a14] border rounded-xl px-3 text-sm font-bold focus:outline-none transition-all text-center ${
                      isHypertension || isHypotension
                        ? 'border-rose-400 focus:border-rose-500 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-50/25 dark:bg-rose-500/5'
                        : initialVitals.bp.confidence === 'low'
                          ? 'border-amber-400 focus:border-amber-500 text-amber-600'
                          : 'border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:border-slate-400 dark:focus:border-slate-500'
                    }`}
                    placeholder="Sys"
                  />
                </div>
                <div className="flex items-center text-slate-400 font-bold">/</div>
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value)}
                    className={`w-full h-12 bg-white dark:bg-[#070a14] border rounded-xl px-3 text-sm font-bold focus:outline-none transition-all text-center ${
                      isHypertension || isHypotension
                        ? 'border-rose-400 focus:border-rose-500 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-50/25 dark:bg-rose-500/5'
                        : initialVitals.bp.confidence === 'low'
                          ? 'border-amber-400 focus:border-amber-500 text-amber-600'
                          : 'border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:border-slate-400 dark:focus:border-slate-500'
                    }`}
                    placeholder="Dia"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 dark:border-white/5 pt-5">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 font-bold text-sm transition-colors active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={isSubmitting}
            className="px-6 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/35 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <Check className="w-4.5 h-4.5" strokeWidth={2.5} />
                <span>Approve & Record Vitals</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
