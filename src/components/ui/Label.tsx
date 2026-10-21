import * as React from 'react';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'text-[12.5px] font-semibold text-slate-300 mb-1.5 inline-block',
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = 'Label';
