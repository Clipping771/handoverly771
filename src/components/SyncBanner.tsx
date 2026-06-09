'use client';

import React from 'react';
import { useSync } from '@/context/SyncContext';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SyncBanner() {
  const { isOnline, pendingCount, syncInProgress } = useSync();

  if (isOnline && pendingCount === 0 && !syncInProgress) {
    return null; // Don't show anything if everything is fine and synced
  }

  let bgColor = 'bg-amber-500';
  let textColor = 'text-white';
  let Icon = WifiOff;
  let message = 'Offline mode enabled. Drafts will be saved locally.';

  if (isOnline) {
    if (syncInProgress) {
      bgColor = 'bg-blue-500';
      Icon = RefreshCw;
      message = `Syncing ${pendingCount} records...`;
    } else if (pendingCount > 0) {
      bgColor = 'bg-rose-500';
      Icon = Wifi;
      message = `${pendingCount} records waiting for sync`;
    } else {
      bgColor = 'bg-emerald-500';
      Icon = CheckCircle2;
      message = 'All changes synced';
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 ${bgColor} ${textColor} px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-semibold shadow-md`}
      >
        <Icon className={`w-4 h-4 ${syncInProgress ? 'animate-spin' : ''}`} />
        <span>{message}</span>
      </motion.div>
    </AnimatePresence>
  );
}
