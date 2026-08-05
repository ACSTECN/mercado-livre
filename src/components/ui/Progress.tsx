import * as React from 'react';
import { cn } from '@/lib/utils';

export function Progress({
  value = 0,
  className,
  label,
}: {
  value?: number;
  className?: string;
  label?: string;
}) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-1.5 flex justify-between text-[11.5px] font-medium text-neutral-600">
        {label && <span>{label}</span>}
        <span className="tabular-nums">{Math.round(v)}%</span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ml-blue to-blue-500 transition-[width] duration-200 ease-out"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
