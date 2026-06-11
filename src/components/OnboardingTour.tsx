'use client';

import React, { useState, useEffect } from 'react';
import { Joyride, STATUS, Step, TooltipRenderProps, EventData } from 'react-joyride';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
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
      className={`w-[340px] p-5 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-300 ${
        isDark
          ? 'bg-[#18181c]/95 border-zinc-800 text-zinc-100 shadow-black/40'
          : 'bg-white/95 border-slate-200/80 text-slate-800 shadow-slate-200/50'
      }`}
    >
      {/* Title / Header */}
      {step.title && (
        <div className="mb-2 font-semibold text-base tracking-tight">
          {step.title}
        </div>
      )}

      {/* Content */}
      <div className={`text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
        {step.content}
      </div>

      {/* Progress & Actions Footer */}
      <div className="mt-5 flex items-center justify-between border-t pt-4 border-slate-100 dark:border-zinc-800/60">
        {/* Progress indicator */}
        <div className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
          {index + 1} <span className="opacity-60">of</span> {size}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-2">
          {/* Skip Button (hidden on last step) */}
          {!isLastStep && (
            <button
              {...skipProps}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isDark
                  ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              Skip
            </button>
          )}

          {/* Back Button */}
          {index > 0 && (
            <button
              {...backProps}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isDark
                  ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              Back
            </button>
          )}

          {/* Next / Done Button */}
          <button
            {...primaryProps}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all text-white bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/20 active:scale-95`}
          >
            {isLastStep ? 'Done' : 'Next'}
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
      content: 'Let us show you around your live care dashboard. This will only take a minute.',
      placement: 'center',
      skipBeacon: true,
    },
    {
      target: '#tour-theme-toggle',
      title: 'Appearance Mode 🌗',
      content: 'Switch between Day and Night mode for comfortable viewing at any time.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-shift-action',
      title: 'Active Shift Tasks 📋',
      content: 'Access your current shift tasks and detailed handovers directly from here.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-role-switcher',
      title: 'Role Switcher 🔄',
      content: 'Toggle between Carer and RN views to view role-specific tasks and medical summaries.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-calendar',
      title: 'Shift Calendar 📅',
      content: 'Navigate between days to review past shift handovers or prepare for upcoming ones.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-urgency-filter',
      title: 'Urgency Filters ⚠️',
      content: 'Quickly filter handovers by severity level: Critical, Attention, or Routine.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-search',
      title: 'Smart Resident Search 🔍',
      content: 'Search for specific resident names or room numbers instantly.',
      placement: 'bottom',
      skipBeacon: true,
    },
  ];

  const shiftSteps: Step[] = [
    {
      target: 'body',
      title: 'Welcome to your Shift Registry 🏥',
      content: 'This is your central clinical workspace for managing resident admissions and recordings.',
      placement: 'center',
      skipBeacon: true,
    },
    {
      target: '#tour-nav-registry',
      title: 'Shift Registry List 📋',
      content: 'This lists all active residents in your facility for this shift.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-nav-tasks',
      title: 'Shift Tasks ⚡',
      content: 'Click here to access active shift tasks, completions, and declines.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-nav-dashboard',
      title: 'Live Facility Dashboard 📊',
      content: 'Click here to view live facility status, statistics, calendar, and role switchers.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-register-resident',
      title: 'Register Resident ➕',
      content: 'Quickly admit a new resident profile to the registry instantly.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-resident-search',
      title: 'Find Resident 🔍',
      content: 'Search resident profiles by name or room number instantly.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-wing-filter',
      title: 'Wing Filter 🏢',
      content: 'Filter the resident list by specific wings or areas.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tour-shift-tabs',
      title: 'Registry States 🔄',
      content: 'Toggle between All, Pending (awaiting handovers), and Completed handovers.',
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
        spotlightRadius: 12,
        blockTargetInteraction: false,
      }}
    />
  );
}