'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      {/* Sleek glowing progress loader line at the top of the screen */}
      <motion.div
        key={`loader-${pathname}`}
        initial={{ width: "0%", opacity: 0.9 }}
        animate={{ width: "100%", opacity: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 h-[3px] bg-gradient-to-r from-primary to-[#00C9A7] z-50 pointer-events-none shadow-[0_1px_12px_rgba(59,130,246,0.6)]"
      />

      {/* Main Page Content */}
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ 
          delay: 0.05,
          duration: 0.55, 
          ease: [0.16, 1, 0.3, 1] // Custom easeOutExpo
        }}
        className="w-full h-full min-h-screen flex flex-col"
      >
        {children}
      </motion.div>
    </>
  );
}
