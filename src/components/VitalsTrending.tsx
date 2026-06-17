'use client';

import React, { useEffect, useRef } from 'react';
import { Activity, Thermometer, Droplets } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface VitalsTrendingProps {
  residentId: string;
}

export default function VitalsTrending({ residentId }: VitalsTrendingProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mock data for demo
  const tempData = [36.5, 36.6, 36.8, 37.1, 37.5, 36.9, 36.7];
  const bpData = [120, 118, 122, 130, 140, 125, 118];
  const o2Data = [98, 99, 98, 96, 95, 97, 99];

  useGSAP(() => {
    gsap.fromTo('.spark-bar', 
      { height: 0, opacity: 0 },
      { height: (i, el) => `${el.dataset.val}%`, opacity: 1, duration: 1, stagger: 0.05, ease: 'back.out(1.5)' }
    );
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {/* Temperature */}
      <div className="apple-card p-4 rounded-3xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-accent/10 rounded-xl text-amber-accent">
              <Thermometer className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Temperature</h4>
          </div>
          <span className="text-lg font-black text-text-primary">36.7°C</span>
        </div>
        <div className="h-10 flex items-end gap-1.5 px-1">
          {tempData.map((val, i) => {
            const height = ((val - 35) / 4) * 100; // normalize 35-39
            return (
              <div key={i} className="flex-1 bg-surface-solid rounded-t-sm relative group cursor-pointer">
                <div 
                  className={`spark-bar w-full rounded-t-sm absolute bottom-0 ${val > 37.3 ? 'bg-rose-500' : 'bg-amber-accent'}`}
                  data-val={height}
                ></div>
                {/* Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-text-primary text-background text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none transition-opacity z-10">
                  {val}°C
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Blood Pressure */}
      <div className="apple-card p-4 rounded-3xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-500/10 rounded-xl text-rose-500">
              <Activity className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Blood Pressure</h4>
          </div>
          <span className="text-lg font-black text-text-primary">118/75</span>
        </div>
        <div className="h-10 flex items-end gap-1.5 px-1">
          {bpData.map((val, i) => {
            const height = ((val - 90) / 70) * 100; // normalize 90-160
            return (
              <div key={i} className="flex-1 bg-surface-solid rounded-t-sm relative group cursor-pointer">
                <div 
                  className={`spark-bar w-full rounded-t-sm absolute bottom-0 ${val > 130 ? 'bg-rose-500' : 'bg-primary'}`}
                  data-val={height}
                ></div>
                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-text-primary text-background text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none transition-opacity z-10">
                  {val} sys
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SpO2 */}
      <div className="apple-card p-4 rounded-3xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-accent/10 rounded-xl text-teal-accent">
              <Droplets className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest">SpO2 Level</h4>
          </div>
          <span className="text-lg font-black text-text-primary">99%</span>
        </div>
        <div className="h-10 flex items-end gap-1.5 px-1">
          {o2Data.map((val, i) => {
            const height = ((val - 85) / 15) * 100; // normalize 85-100
            return (
              <div key={i} className="flex-1 bg-surface-solid rounded-t-sm relative group cursor-pointer">
                <div 
                  className={`spark-bar w-full rounded-t-sm absolute bottom-0 ${val < 92 ? 'bg-rose-500' : 'bg-teal-accent'}`}
                  data-val={height}
                ></div>
                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-text-primary text-background text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none transition-opacity z-10">
                  {val}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
