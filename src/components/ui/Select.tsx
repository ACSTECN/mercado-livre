import * as React from 'react';
import { cn } from '@/lib/utils';

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'flex h-12 w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 pr-10 text-[15px] text-white transition focus-visible:outline-none focus-visible:border-sky-400/50 focus-visible:bg-white/[0.09] focus-visible:ring-2 focus-visible:ring-sky-400/40 disabled:cursor-not-allowed disabled:opacity-60 [&>option]:bg-slate-900 [&>option]:text-slate-100',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}
