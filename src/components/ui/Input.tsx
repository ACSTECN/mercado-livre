import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-[15px] text-neutral-900 shadow-sm placeholder:text-neutral-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ml-blue/50 focus-visible:border-ml-blue/60 disabled:cursor-not-allowed disabled:bg-neutral-50',
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
        'flex min-h-[90px] w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-[15px] text-neutral-900 shadow-sm placeholder:text-neutral-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ml-blue/50 focus-visible:border-ml-blue/60 disabled:cursor-not-allowed disabled:bg-neutral-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
