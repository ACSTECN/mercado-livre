import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-ml-yellow text-neutral-900 shadow-sm hover:bg-[#fde800] shadow-[0_1px_0_rgba(0,0,0,0.06)]',
        primary:
          'bg-ml-blue text-white shadow-md shadow-blue-500/25 hover:bg-blue-600',
        secondary:
          'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 border border-neutral-200',
        outline:
          'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50',
        ghost:
          'text-neutral-700 hover:bg-neutral-100',
        destructive:
          'bg-red-500 text-white shadow-sm hover:bg-red-600',
        success:
          'bg-success text-white shadow-sm hover:bg-emerald-600',
      },
      size: {
        default: 'h-11 px-5 py-2',
        xs: 'h-7 px-2 text-[11px]',
        sm: 'h-9 px-3.5 text-xs',
        lg: 'h-14 px-6 text-base',
        xl: 'h-16 px-7 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
