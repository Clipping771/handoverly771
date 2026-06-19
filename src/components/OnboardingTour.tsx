'use client';

import React, { useState, useEffect } from 'react';
import { Joyride, STATUS, Step, TooltipRenderProps, EventData } from 'react-joyride';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContextProvider';
import { usePathname } from 'next/navigation';

const getTourKey = (userId: string, pageType: string) => `handoverly_onboarding_v3_${userId}_${pageType}`;

// Custom Tooltip Component for Premium, Theme-Aware Aesthetics
function CustomTooltip({
  index,
  isLastStep,
  size,
  step,
  backProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      {...tooltipProps}
      className={`w-[360px] p-6 rounded-[28px] border backdrop-blur-2xl shadow-2xl transition-all duration-300 relative animate-in fade-in-50 zoom-in-95 ${
        isDark
          ? 'bg-[#0f172a] border-slate-800/80 text-slate-100 shadow-black/60'
          : 'bg-white border-slate-200/60 text-slate-850 shadow-slate-200/50'
      }`}
    >
      {/* Header Accent Badge & Close Button */}
      <div className="flex items-center justify-between mb-5">
        <span className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1.5 rounded-full ${
          isDark ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-primary/10 text-primary border border-primary/20'
        }`}>
          ✨ Clinical Guide
        </span>
        <button
          {...skipProps}
          className={`p-1.5 rounded-full transition-all hover:scale-105 ${
            isDark ? 'text-slate-500 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
          }`}
          title="Exit Tour"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Title / Header */}
      {step.title && (
        <h3 className="mb-2 font-extrabold text-base tracking-tight text-text-primary">
          {step.title}
        </h3>
      )}

      {/* Content */}
      <p className={`text-xs leading-relaxed font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {step.content}
      </p>

      {/* Footer Navigation & Progress Indicator */}
      <div className="mt-7 flex items-center justify-between">
        {/* Progress Dots Indicator */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: size }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index
                  ? `w-4 ${isDark ? 'bg-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.6)]' : 'bg-primary'}`
                  : `w-1.5 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`
              }`}
            />
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-2">
          {/* Back Button */}
          {index > 0 && (
            <button
              {...backProps}
              className={`px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all border outline-none active:scale-95 cursor-pointer ${
                isDark
                  ? 'text-slate-350 border-slate-800 hover:bg-slate-800/80 hover:text-slate-100'
                  : 'text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-850'
              }`}
            >
              Back
            </button>
          )}

          {/* Next / Done Button */}
          <button
            {...primaryProps}
            className={`px-4.5 py-2.5 rounded-xl text-[11px] font-bold shadow-md transition-all text-white active:scale-95 flex items-center gap-1.5 cursor-pointer outline-none ${
              isDark
                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 shadow-teal-500/20'
                : 'bg-gradient-to-r from-primary to-teal-400 hover:opacity-95 shadow-primary/20'
            }`}
          >
            <span>{isLastStep ? 'Done' : 'Next'}</span>
            <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingTour() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [run, setRun] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const pageType = pathname === '/shift' ? 'shift' : 'dashboard';

  useEffect(() => {
    if (!user) return;
    const tourKey = getTourKey(user.id, pageType);
    const hasSeenTour = localStorage.getItem(tourKey);
    if (!hasSeenTour) {
      const timer = setTimeout(() => setRun(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [user, pageType]);

  const handleCallback = (data: EventData) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      if (user) {
        localStorage.setItem(getTourKey(user.id, pageType), 'true');
      }
      setRun(false);
    }
  };

  const dashboardSteps: Step[] = [
    {
      target: 'body',
      title: 'Welcome to Handoverly 👋',
      content: 'Welcome to your real-time synchronization center. Let\'s get you familiarized with the clinical communication suite.',
      placement: 'center',
      skipBeacon: true,
    },
    {
      target: '#tour-theme-toggle',
      title: 'Appearance Mode 🌗',
      content: 'Toggle between Day and Night mode to ensure high readability during standard and overnight shifts.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-shift-action',
      title: 'Active Registry Roster 📋',
      content: 'Access resident profiles, shift activities, and validate clinical summaries directly from here.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-role-switcher',
      title: 'Clinical Role Customization 🔄',
      content: 'Seamlessly toggle between Carer (task-oriented checklists) and RN (ISBAR summary and medical validation) views.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-calendar',
      title: 'Temporal Registry Navigator 📅',
      content: 'Navigate across shift dates to review historical clinical records or prepare for upcoming handovers.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-urgency-filter',
      title: 'Risk Urgency Triage ⚠️',
      content: 'Instantly filter patient handovers by critical status, ensuring immediate attention to high-risk residents.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-search',
      title: 'Dynamic Resident Locator 🔍',
      content: 'Locate residents instantly by typing their name, room number, or ward details.',
      placement: 'bottom',
      skipBeacon: true,
    },
  ];

  const shiftSteps: Step[] = [
    {
      target: 'body',
      title: 'Welcome to your Shift Registry 🏥',
      content: 'This is your central workspace. Manage patient statuses, validate AI-generated clinical insights, and publish handovers.',
      placement: 'center',
      skipBeacon: true,
    },
    {
      target: '#tour-nav-registry',
      title: 'Active Patient Roster 📋',
      content: 'This lists all active residents currently assigned to this facility for the active shift.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-nav-tasks',
      title: 'Clinical Task Suite ⚡',
      content: 'Track active shift activities, checklist completions, and outstanding care directives.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-nav-dashboard',
      title: 'Real-Time Dashboard 📊',
      content: 'Return to the main dashboard to view facility statistics, calendar views, and triage details.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-register-resident',
      title: 'New Patient Admission ➕',
      content: 'Admit a new resident profile to the registry database, assigning room numbers and care levels.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-resident-search',
      title: 'Smart Index Finder 🔍',
      content: 'Filter the registry instantly to check on a specific resident\'s clinical status.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-wing-filter',
      title: 'Ward Allocation Filter 🏢',
      content: 'Segment residents by wings or specialized care units for optimized shift management.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-shift-tabs',
      title: 'Workflow State Triage 🔄',
      content: 'Monitor completion progress by toggling between All, Pending (needs logs), and Published handovers.',
      placement: 'bottom',
      skipBeacon: true,
    },
  ];

  const steps = pageType === 'shift' ? shiftSteps : dashboardSteps;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleCallback}
      tooltipComponent={CustomTooltip}
      options={{
        zIndex: 10000,
        scrollOffset: 120,
        overlayClickAction: false,
        spotlightRadius: 16,
        blockTargetInteraction: false,
        arrowColor: isDark ? '#0f172a' : '#ffffff',
      }}
    />
  );
}