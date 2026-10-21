import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-bold transition-all duration-200 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
  {
    variants: {
      variant: {
        default:
          'bg-[linear-gradient(135deg,#fff159,#f5e100)] text-neutral-950 shadow-[0_14px_30px_rgba(255,241,89,0.24)] hover:brightness-[1.03]',
        primary:
          'bg-[linear-gradient(135deg,#3483fa,#5f6cf9)] text-white shadow-[0_16px_32px_rgba(52,131,250,0.28)] hover:brightness-110',
        secondary:
          'border border-white/12 bg-white/[0.06] text-slate-100 shadow-[0_10px_26px_rgba(0,0,0,0.24)] hover:border-white/20 hover:bg-white/10',
        outline:
          'border border-white/14 bg-white/6 text-slate-100 backdrop-blur-md hover:bg-white/10',
        ghost:
          'text-slate-200 hover:bg-white/8',
        destructive:
          'bg-[linear-gradient(135deg,#ef4444,#dc2626)] text-white shadow-[0_14px_28px_rgba(239,68,68,0.24)] hover:brightness-105',
        success:
          'bg-[linear-gradient(135deg,#10b981,#059669)] text-white shadow-[0_14px_28px_rgba(16,185,129,0.24)] hover:brightness-105',
      },
      size: {
        default: 'h-12 px-5 py-2.5',
        xs: 'h-8 px-2.5 text-[11px]',
        sm: 'h-10 px-4 text-xs',
        lg: 'h-14 px-6 text-base',
        xl: 'h-16 px-8 text-base',
        icon: 'h-11 w-11',
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
