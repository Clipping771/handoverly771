import React, { useState } from 'react';
import { Bell, X, ShieldAlert, AlertTriangle, AlertCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SentinelBadgeProps {
  unacknowledgedTasks: any[];
  proactiveAlerts: any[];
  onAcknowledgeAlert?: (alertId: string, alertMessage: string) => Promise<void>;
  onAcknowledgeTask?: (taskId: string) => Promise<void>;
}

export default function SentinelBadge({
  unacknowledgedTasks = [],
  proactiveAlerts = [],
  onAcknowledgeAlert,
  onAcknowledgeTask
}: SentinelBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Group alerts
  const criticalCount = unacknowledgedTasks.length + proactiveAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = proactiveAlerts.filter(a => a.severity === 'warning').length;
  const totalCount = criticalCount + warningCount;

  // Badge configuration
  let badgeColor = '';
  let pulseClass = '';

  if (criticalCount > 0) {
    badgeColor = 'bg-[#E8445A]'; // Red
    pulseClass = 'animate-pulse scale-110';
  } else if (warningCount > 0) {
    badgeColor = 'bg-[#F5A623]'; // Amber
  } else if (totalCount > 0) {
    badgeColor = 'bg-blue-500'; // Info (Blue)
  }

  return (
    <>
      {/* Icon Badge in Header */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all dark:bg-[#121214] dark:hover:bg-[#1c1c21] dark:border dark:border-[#202024] dark:text-slate-300 cursor-pointer flex items-center justify-center"
          title="Sentinel Alerts"
        >
          <Bell className="w-4 h-4" />
          {totalCount > 0 && (
            <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${badgeColor} ${pulseClass} text-[10px] font-black text-white flex items-center justify-center shadow-md`}>
              {totalCount}
            </span>
          )}
        </button>
      </div>

      {/* Slide-in Sidebar Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-slate-900/30 dark:bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsOpen(false)}
            ></div>

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white dark:bg-[#1A1D27] border-l border-slate-200 dark:border-[#2A2D3A] shadow-2xl flex flex-col"
            >
              {/* Panel Header */}
              <div className="p-5 border-b border-slate-150 dark:border-[#2A2D3A] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <ShieldAlert className="w-4.5 h-4.5 text-indigo-500" />
                    Sentinel Alerts Chain
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-450 mt-0.5">
                    Real-time compliance & safety monitoring
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-650 dark:hover:text-slate-350 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Critical section */}
                {criticalCount > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-[#E8445A] uppercase tracking-widest pl-1">
                      🔴 Critical / Unacknowledged ({criticalCount})
                    </h4>
                    
                    {/* Uncompleted Tasks */}
                    {unacknowledgedTasks.map(t => (
                      <div key={t.id} className="p-4 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-950/20 rounded-2xl space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-[#E8445A] shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t.title}</span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t.description}</p>
                          </div>
                        </div>
                        {onAcknowledgeTask && (
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => onAcknowledgeTask(t.id)}
                              className="px-3 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-bold border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors"
                            >
                              <Check className="w-3 h-3 text-[#22C55E]" />
                              Complete Task
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Proactive Critical Alerts */}
                    {proactiveAlerts.filter(a => a.severity === 'critical').map(alert => (
                      <div key={alert.id} className="p-4 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-950/20 rounded-2xl space-y-2">
                        <div className="flex items-start gap-2">
                          <ShieldAlert className="w-4 h-4 text-[#E8445A] shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{alert.message}</span>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Evidence: {alert.evidence}</p>
                          </div>
                        </div>
                        {onAcknowledgeAlert && (
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => onAcknowledgeAlert(alert.id, alert.message)}
                              className="px-3 py-1 bg-[#E8445A] hover:bg-[#d63b50] text-white text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                            >
                              Acknowledge
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Warning section */}
                {warningCount > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-[#F5A623] uppercase tracking-widest pl-1">
                      🟡 Warning / Emerging ({warningCount})
                    </h4>
                    {proactiveAlerts.filter(a => a.severity === 'warning').map(alert => (
                      <div key={alert.id} className="p-4 bg-amber-50/20 dark:bg-amber-950/5 border border-amber-100 dark:border-amber-950/10 rounded-2xl space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-[#F5A623] shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{alert.message}</span>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Evidence: {alert.evidence}</p>
                          </div>
                        </div>
                        {onAcknowledgeAlert && (
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => onAcknowledgeAlert(alert.id, alert.message)}
                              className="px-3 py-1 bg-[#F5A623] hover:bg-[#e09418] text-white text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                            >
                              Acknowledge
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {criticalCount === 0 && warningCount === 0 && (
                  <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500">
                    <Check className="w-8 h-8 text-[#22C55E] mb-2" />
                    <p className="text-xs font-bold">No active warnings or uncompleted tasks</p>
                    <p className="text-[10px] mt-0.5">Facility operations are within normal ranges</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
