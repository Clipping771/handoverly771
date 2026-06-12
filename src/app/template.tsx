'use client';

import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ 
        duration: 0.35, 
        ease: [0.45, 0, 0.55, 1] // equivalent to gsap's power2.inOut
      }}
    >
      {children}
    </motion.div>
  );
}
