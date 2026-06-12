'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      {/* Sleek Vercel-style glowing progress loader at the top of the screen */}
      <motion.div
        key={`loader-${pathname}`}
        initial={{ width: "0%", opacity: 0.9 }}
        animate={{ width: "100%", opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 h-[3px] bg-gradient-to-r from-primary to-[#00C9A7] z-50 pointer-events-none shadow-[0_1px_10px_rgba(59,130,246,0.6)]"
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 12, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.985 }}
          transition={{ 
            duration: 0.32, 
            ease: [0.22, 1, 0.36, 1] // Custom cubic-bezier (Apple Ease Out)
          }}
          className="w-full h-full min-h-screen flex flex-col"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
