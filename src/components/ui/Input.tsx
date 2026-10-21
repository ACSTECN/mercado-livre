import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-12 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-[15px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-500 transition focus-visible:outline-none focus-visible:border-sky-400/50 focus-visible:bg-white/[0.09] focus-visible:ring-2 focus-visible:ring-sky-400/40 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[96px] w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-500 transition focus-visible:outline-none focus-visible:border-sky-400/50 focus-visible:bg-white/[0.09] focus-visible:ring-2 focus-visible:ring-sky-400/40 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
