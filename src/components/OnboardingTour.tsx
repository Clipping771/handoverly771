'use client';

import React, { useState, useEffect } from 'react';
import { Joyride, STATUS, Step } from 'react-joyride';

export default function OnboardingTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Check if the user has already seen the tour
    const hasSeenTour = localStorage.getItem('hasSeenOnboardingTour');
    if (!hasSeenTour) {
      setRun(true);
    }
  }, []);

  const steps: Step[] = [
    {
      target: 'body',
      content: 'Welcome to Handoverly! Let us give you a quick tour of your new dashboard.',
      placement: 'center',
    },
    {
      target: '#tour-role-switcher',
      content: 'Switch between Carer and RN views to see role-specific summaries and tasks.',
      placement: 'bottom',
    },
    {
      target: '#tour-calendar',
      content: 'Navigate through different days to view past shift handovers or upcoming ones.',
      placement: 'bottom',
    },
    {
      target: '#tour-urgency-filter',
      content: 'Filter handovers by urgency: Critical, Attention, or Routine.',
      placement: 'bottom',
    },
    {
      target: '#tour-search',
      content: 'Search for specific residents or room numbers quickly.',
      placement: 'bottom',
    },
    {
      target: '#tour-theme-toggle',
      content: 'Toggle between Day and Night modes for comfortable viewing at any time.',
      placement: 'bottom',
    },
    {
      target: '#tour-shift-action',
      content: 'Access your specific shift tasks or shift details from here.',
      placement: 'bottom',
    }
  ];

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      // Mark the tour as completed so it doesn't run again
      localStorage.setItem('hasSeenOnboardingTour', 'true');
      setRun(false);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      scrollToFirstStep={true}
      showProgress={true}
      showSkipButton={true}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#3b82f6', // blue-500
          zIndex: 10000,
        },
      }}
    />
  );
}
