'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CalendarDays, Sparkles } from 'lucide-react';

interface AdvancedCalendarProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
  datesWithHandovers: string[]; // YYYY-MM-DD strings
}

export default function AdvancedCalendar({
  selectedDate,
  onChange,
  datesWithHandovers = []
}: AdvancedCalendarProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date(selectedDate));
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync viewMonth when selectedDate changes externally
  useEffect(() => {
    setViewMonth(new Date(selectedDate));
  }, [selectedDate]);

  // Click outside handler for popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDateToYYYYMMDD = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isToday = (d: Date): boolean => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (d: Date): boolean => {
    return (
      d.getDate() === selectedDate.getDate() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    );
  };

  const hasHandover = (d: Date): boolean => {
    const dateStr = formatDateToYYYYMMDD(d);
    return datesWithHandovers.includes(dateStr);
  };

  // Generate 7 days for the horizontal strip (centered around selectedDate)
  const getStripDays = (): Date[] => {
    const days: Date[] = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(selectedDate);
      d.setDate(selectedDate.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(selectedDate.getDate() - 1);
    onChange(prev);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(selectedDate.getDate() + 1);
    onChange(next);
  };

  const handleSelectDate = (d: Date) => {
    onChange(d);
    setIsPopoverOpen(false);
  };

  // Month navigation
  const handlePrevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  };

  // Generate monthly grid days
  const getMonthGridDays = (): { date: Date; currentMonth: boolean }[] => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();

    const grid: { date: Date; currentMonth: boolean }[] = [];

    // Prev month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      grid.push({
        date: new Date(year, month - 1, prevTotalDays - i),
        currentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      grid.push({
        date: new Date(year, month, i),
        currentMonth: true
      });
    }

    // Next month days to fill grid of 42
    const remaining = 42 - grid.length;
    for (let i = 1; i <= remaining; i++) {
      grid.push({
        date: new Date(year, month + 1, i),
        currentMonth: false
      });
    }

    return grid;
  };

  const weekDaysShort = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const formattedSelectedDate = selectedDate.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="w-full bg-white dark:bg-[#121214] border border-slate-200/80 dark:border-white/5 rounded-3xl p-5 shadow-sm transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        
        {/* Active Date Display with Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevDay}
            className="p-2.5 rounded-full border border-slate-200/60 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 transition-colors"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-450 dark:text-slate-500">Selected Date</span>
            <span className="text-base font-semibold text-slate-900 dark:text-white mt-0.5">{formattedSelectedDate}</span>
          </div>

          <button
            onClick={handleNextDay}
            className="p-2.5 rounded-full border border-slate-200/60 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 transition-colors"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Calendar Strip & Monthly Selector */}
        <div className="flex flex-wrap items-center gap-3 md:self-end">
          
          {/* Weekday Strip */}
          <div className="flex gap-1.5 p-1 bg-slate-100/80 dark:bg-white/5 rounded-2xl border border-slate-200/30 dark:border-white/5">
            {getStripDays().map((date, idx) => {
              const active = isSelected(date);
              const hasRecords = hasHandover(date);
              const isTd = isToday(date);
              
              return (
                <button
                  key={idx}
                  onClick={() => onChange(date)}
                  className={`relative flex flex-col items-center justify-center w-12 h-14 rounded-[14px] transition-all duration-200 cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-[#2a2a2d] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200/50 dark:ring-white/10 font-bold scale-[1.03]'
                      : 'hover:bg-white/40 dark:hover:bg-white/5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  <span className="text-[9px] uppercase tracking-wider opacity-75">{date.toLocaleDateString('en-AU', { weekday: 'short' })}</span>
                  <span className="text-sm mt-0.5">{date.getDate()}</span>
                  
                  {/* Indicators */}
                  {hasRecords && (
                    <span className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${active ? 'bg-blue-500 dark:bg-blue-400' : 'bg-slate-400 dark:bg-slate-500'}`} />
                  )}
                  {isTd && !active && (
                    <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-red-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Popover Calendar Trigger */}
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setIsPopoverOpen(!isPopoverOpen)}
              className={`flex items-center gap-2 px-4.5 py-3 rounded-2xl border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isPopoverOpen
                  ? 'bg-slate-900 border-slate-950 text-white dark:bg-white dark:border-white dark:text-[#0b0b0d]'
                  : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-700 dark:bg-[#1a1a1c] dark:border-white/10 dark:hover:border-white/20 dark:text-slate-200'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Calendar</span>
            </button>

            {/* Premium Calendar Dropdown */}
            {isPopoverOpen && (
              <div className="absolute right-0 mt-3 z-50 w-80 bg-white dark:bg-[#121214] border border-slate-250/80 dark:border-white/10 p-5 rounded-[24px] shadow-2xl animate-in fade-in slide-in-from-top-3 duration-250">
                
                {/* Month/Year Navigation Header */}
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {monthNames[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                  </h4>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1.5 rounded-xl border border-slate-200/60 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNextMonth}
                      className="p-1.5 rounded-xl border border-slate-200/60 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Weekday Labels */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  {weekDaysShort.map((day) => (
                    <div key={day} className="py-1">{day}</div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {getMonthGridDays().map(({ date, currentMonth }, idx) => {
                    const active = isSelected(date);
                    const isTd = isToday(date);
                    const hasRecords = hasHandover(date);

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectDate(date)}
                        className={`relative flex flex-col items-center justify-center h-10 w-10 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                          !currentMonth
                            ? 'text-slate-300 dark:text-slate-700 hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'
                            : active
                            ? 'bg-blue-600 text-white dark:bg-blue-500'
                            : isTd
                            ? 'border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10'
                            : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-755 dark:text-slate-300'
                        }`}
                      >
                        <span>{date.getDate()}</span>
                        {hasRecords && (
                          <span
                            className={`absolute bottom-1 w-1 h-1 rounded-full ${
                              active ? 'bg-white' : 'bg-blue-500 dark:bg-blue-400'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Quick Shortcuts Footer */}
                <div className="mt-5 pt-4 border-t border-slate-150/60 dark:border-white/5 flex gap-2">
                  <button
                    onClick={() => handleSelectDate(new Date())}
                    className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider text-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-350"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      handleSelectDate(yesterday);
                    }}
                    className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider text-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-350"
                  >
                    Yesterday
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
