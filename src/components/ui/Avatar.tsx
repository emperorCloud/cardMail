import React from 'react';
import { cn, getInitials } from '../../lib/utils.ts';

// Dégradés issus du logo : surtout des bleus, l'orange reste rare pour garder sa valeur de signal.
const GRADIENTS = [
  'from-[#2b6df0] to-[#1245b0]',
  'from-[#22a7f0] to-[#1556d6]',
  'from-[#4f6cf0] to-[#2a3fb0]',
  'from-[#1e4fb8] to-[#0a1b45]',
  'from-[#3d8bfd] to-[#1b57c9]',
  'from-[#ffa534] to-[#ec6f00]',
];

function hash(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return h;
}

const SIZES = { sm: 'h-8 w-8 text-[11px]', md: 'h-10 w-10 text-xs', lg: 'h-11 w-11 text-sm' } as const;

export const SenderAvatar: React.FC<{ name: string; size?: keyof typeof SIZES; className?: string }> = ({ name, size = 'md', className }) => (
  <div
    aria-hidden="true"
    className={cn(
      'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-display font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_10px_-4px_rgba(21,86,214,0.55)]',
      GRADIENTS[hash(name || '?') % GRADIENTS.length],
      SIZES[size],
      className
    )}
  >
    {getInitials(name || '?')}
  </div>
);
