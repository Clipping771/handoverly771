import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, ShieldAlert, AlertTriangle, AlertCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SentinelBadgeProps {
  userId: string;
  unacknowledgedTasks: any[];
  proactiveAlerts: any[];
  onAcknowledgeAlert?: (alertId: string, alertMessage: string, residentId?: string) => Promise<void>;
  onAcknowledgeTask?: (taskId: string) => Promise<void>;
}

export default function SentinelBadge({
  userId,
  unacknowledgedTasks = [],
  proactiveAlerts = [],
  onAcknowledgeAlert,
  onAcknowledgeTask
}: SentinelBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load seen IDs on mount
  useEffect(() => {
    const saved = localStorage.getItem(`sentinel_seen_ids_${userId}`);
    if (saved) {
      try { setSeenIds(new Set(JSON.parse(saved))); } catch(e){}
    }
  }, [userId]);

  // When opening the panel, mark all current alerts/tasks as seen
  useEffect(() => {
    if (isOpen) {
      const currentIds = [
        ...unacknowledgedTasks.map(t => t.id),
        ...proactiveAlerts.map(a => a.id)
      ];
      
      setSeenIds(prev => {
        const newSet = new Set(prev);
        let changed = false;
        currentIds.forEach(id => {
          if (!newSet.has(id)) {
            newSet.add(id);
            changed = true;
          }
        });
        
        if (changed) {
          localStorage.setItem(`sentinel_seen_ids_${userId}`, JSON.stringify(Array.from(newSet)));
        }
        return newSet;
      });
    }
  }, [isOpen, unacknowledgedTasks, proactiveAlerts, userId]);

  // Group alerts (For the panel view - shows everything)
  const criticalCount = unacknowledgedTasks.filter(t => !dismissedIds.has(t.id)).length + proactiveAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = proactiveAlerts.filter(a => a.severity === 'warning').length;

  // Unseen counts (For the bell badge - shows only unseen)
  const unseenCriticalCount = unacknowledgedTasks.filter(t => !seenIds.has(t.id) && !dismissedIds.has(t.id)).length + 
                              proactiveAlerts.filter(a => a.severity === 'critical' && !seenIds.has(a.id)).length;
  const unseenWarningCount = proactiveAlerts.filter(a => a.severity === 'warning' && !seenIds.has(a.id)).length;
  const unseenTotalCount = unseenCriticalCount + unseenWarningCount;

  // Badge configuration based ONLY on unseen alerts
  let badgeColor = '';

  if (unseenCriticalCount > 0) {
    badgeColor = 'bg-[#E8445A]'; // Red
  } else if (unseenWarningCount > 0) {
    badgeColor = 'bg-[#F5A623]'; // Amber
  } else if (unseenTotalCount > 0) {
    badgeColor = 'bg-blue-500'; // Info (Blue)
  }

  return (
    <>
      {/* Icon Badge in Header */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all dark:bg-[#121214] dark:hover:bg-[#1c1c21] dark:border dark:border-[#202024] dark:text-slate-300 cursor-pointer flex items-center justify-center relative"
          title="Sentinel Alerts"
        >
          <motion.div
            animate={unseenTotalCount > 0 ? { rotate: [0, -20, 20, -20, 20, -10, 10, 0] } : {}}
            transition={{ repeat: Infinity, duration: 0.6, repeatDelay: 1.5 }}
          >
            <Bell className="w-4 h-4 relative z-10" />
          </motion.div>
          
          <AnimatePresence>
            {unseenTotalCount > 0 && (
              <motion.span 
                key={unseenTotalCount}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${badgeColor} text-[10px] font-black text-white flex items-center justify-center z-20 border-2 border-white dark:border-[#121214]`}
                style={{
                  boxShadow: `0 0 12px ${badgeColor === 'bg-[#E8445A]' ? '#E8445A' : badgeColor === 'bg-[#F5A623]' ? '#F5A623' : '#3B82F6'}`
                }}
              >
                {unseenTotalCount > 9 ? '9+' : unseenTotalCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Slide-in Sidebar Panel */}
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-[100] bg-slate-900/30 dark:bg-black/60 backdrop-blur-xs transition-opacity"
                onClick={() => setIsOpen(false)}
              ></div>

              {/* Panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 z-[110] w-full max-w-[400px] bg-white/95 dark:bg-[#020617]/90 backdrop-blur-3xl border-l border-white/20 dark:border-white/10 shadow-[0_0_60px_-15px_rgba(0,0,0,0.5)] flex flex-col"
              >
              {/* Panel Header */}
              <div className="relative overflow-hidden p-6 border-b border-slate-200/50 dark:border-white/5 bg-gradient-to-br from-blue-50/50 via-white/50 to-cyan-50/50 dark:from-blue-950/20 dark:via-black/20 dark:to-cyan-950/20 backdrop-blur-xl">
                {/* Decorative background glow */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-cyan-500/10 dark:bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 p-[1px] shadow-lg shadow-blue-500/20">
                      <div className="w-full h-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-[15px] flex items-center justify-center">
                        <ShieldAlert className="w-6 h-6 text-blue-500 dark:text-blue-400 drop-shadow-sm" />
                      </div>
                      {/* Pulse ring around icon */}
                      <div className="absolute inset-0 rounded-2xl border-2 border-blue-500/30 animate-ping" style={{ animationDuration: '3s' }}></div>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
                        Alert System
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 shadow-sm shadow-blue-500/10">
                          <span className="flex h-1.5 w-1.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-600 dark:bg-blue-400"></span>
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">Live</span>
                        </div>
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        Real-time Monitoring Chain
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2.5 rounded-full bg-white/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all border border-slate-200/50 dark:border-white/5 shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative">
                {/* Critical section */}
                {criticalCount > 0 && (
                  <div className="space-y-3 relative z-10">
                    <h4 className="text-[10px] font-black text-[#E8445A] uppercase tracking-widest pl-1 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#E8445A] animate-pulse"></span>
                      Critical / Unacknowledged ({criticalCount})
                    </h4>
                    
                    {/* Uncompleted Tasks */}
                    {unacknowledgedTasks.filter(t => !dismissedIds.has(t.id)).map(t => {
                      const isRn = t.assigned_role === 'rn';
                      const isCarer = !isRn && t.assigned_role !== 'all';
                      
                      const cardClass = isRn 
                        ? 'bg-purple-50/50 border-purple-200 dark:bg-purple-500/10 dark:border-purple-500/20' 
                        : isCarer 
                          ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20'
                          : 'bg-slate-50/50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700';
                          
                      const iconColor = isRn ? 'text-purple-500' : isCarer ? 'text-blue-500' : 'text-slate-500';
                      const iconBg = isRn ? 'bg-purple-500/20' : isCarer ? 'bg-blue-500/20' : 'bg-slate-500/20';

                      return (
                        <motion.div 
                          key={t.id} 
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.7}
                          onDragEnd={(e, info) => {
                            if (info.offset.x > 100 || info.offset.x < -100) {
                              setDismissedIds(prev => new Set(prev).add(t.id));
                            }
                          }}
                          whileDrag={{ scale: 0.95, opacity: 0.8 }}
                          layout
                          className={`p-4 rounded-2xl space-y-2 backdrop-blur-sm shadow-sm transition-colors border cursor-grab active:cursor-grabbing ${cardClass}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                              <AlertCircle className={`w-4 h-4 ${iconColor}`} />
                            </div>
                            <div>
                              <div className="flex items-center flex-wrap gap-2 mb-1">
                                <span className="text-[13px] font-bold text-slate-800 dark:text-slate-200 leading-tight">{t.title}</span>
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                                  isRn 
                                    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20' 
                                    : t.assigned_role === 'all'
                                      ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                      : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20'
                                }`}>
                                  {isRn ? 'For RNs' : t.assigned_role === 'all' ? 'For All Staff' : 'For Carers'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{t.description}</p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}

                    {/* Proactive Critical Alerts */}
                    {proactiveAlerts.filter(a => a.severity === 'critical' && !dismissedIds.has(a.id)).map(alert => (
                      <div key={alert.id} className="p-4 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2 backdrop-blur-sm shadow-sm hover:border-rose-500/40 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                            <ShieldAlert className="w-4 h-4 text-[#E8445A]" />
                          </div>
                          <div>
                            <span className="text-[13px] font-bold text-slate-800 dark:text-slate-200 leading-tight block mb-1">{alert.message}</span>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed bg-white/40 dark:bg-black/20 p-2 rounded-lg mt-2 border border-black/5 dark:border-white/5">
                              <span className="font-bold text-slate-700 dark:text-slate-300 mr-1">Evidence:</span> {alert.evidence}
                            </p>
                          </div>
                        </div>
                        {onAcknowledgeAlert && !dismissedIds.has(alert.id) && (
                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => {
                                setDismissedIds(prev => new Set(prev).add(alert.id));
                                onAcknowledgeAlert(alert.id, alert.message, alert.residentId);
                              }}
                              className="px-4 py-1.5 bg-[#E8445A] hover:bg-[#d63b50] text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-rose-500/20 hover:shadow-lg"
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
                  <div className="space-y-3 relative z-10">
                    <h4 className="text-[10px] font-black text-[#F5A623] uppercase tracking-widest pl-1 flex items-center gap-2 mt-6">
                      <span className="w-2 h-2 rounded-full bg-[#F5A623] animate-pulse"></span>
                      Warning / Emerging ({warningCount})
                    </h4>
                    {proactiveAlerts.filter(a => a.severity === 'warning' && !dismissedIds.has(a.id)).map(alert => (
                      <div key={alert.id} className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2 backdrop-blur-sm shadow-sm hover:border-amber-500/40 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4 text-[#F5A623]" />
                          </div>
                          <div>
                            <span className="text-[13px] font-bold text-slate-800 dark:text-slate-200 leading-tight block mb-1">{alert.message}</span>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed bg-white/40 dark:bg-black/20 p-2 rounded-lg mt-2 border border-black/5 dark:border-white/5">
                              <span className="font-bold text-slate-700 dark:text-slate-300 mr-1">Evidence:</span> {alert.evidence}
                            </p>
                          </div>
                        </div>
                        {onAcknowledgeAlert && !dismissedIds.has(alert.id) && (
                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => {
                                setDismissedIds(prev => new Set(prev).add(alert.id));
                                onAcknowledgeAlert(alert.id, alert.message, alert.residentId);
                              }}
                              className="px-4 py-1.5 bg-[#F5A623] hover:bg-[#e09418] text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 hover:shadow-lg"
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
                  <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-6 relative">
                    {/* Cool background radar/pulse effect */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                       <div className="w-[300px] h-[300px] border border-emerald-500/10 rounded-full absolute animate-[ping_4s_linear_infinite]"></div>
                       <div className="w-[220px] h-[220px] border border-emerald-500/20 rounded-full absolute animate-[ping_4s_linear_infinite_1s]"></div>
                       <div className="w-[140px] h-[140px] border border-emerald-500/30 rounded-full absolute animate-[ping_4s_linear_infinite_2s]"></div>
                       
                       <div className="w-full h-full absolute bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05)_0%,transparent_70%)]"></div>
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                      <div className="relative mb-8">
                        <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                        <div className="w-20 h-20 bg-gradient-to-tr from-emerald-400 to-emerald-600 rounded-2xl p-[2px] shadow-[0_0_30px_rgba(16,185,129,0.3)] rotate-3 hover:rotate-0 transition-transform duration-500">
                          <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center">
                            <ShieldAlert className="w-8 h-8 text-emerald-500" />
                          </div>
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">System Nominal</h3>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-2 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active Monitoring Engaged
                      </p>
                      
                      <div className="w-full max-w-[200px] h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent my-6"></div>
                      
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-[240px]">
                        No critical warnings or unacknowledged alerts detected. Sentinel is actively analyzing resident timelines in the background.
                      </p>

                      {/* Small animated status dots */}
                      <div className="flex gap-6 mt-8">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Systems</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Task Queue</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
