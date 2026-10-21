import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, AlertTriangle, X, Info, Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold whitespace-nowrap backdrop-blur-md',
  {
    variants: {
      variant: {
        default: 'border-white/12 bg-white/[0.07] text-slate-200',
        success: 'border-emerald-400/30 bg-emerald-400/12 text-emerald-300',
        warning: 'border-amber-400/30 bg-amber-400/12 text-amber-300',
        danger: 'border-red-400/30 bg-red-400/12 text-red-300',
        info: 'border-sky-400/30 bg-sky-400/12 text-sky-300',
        primary: 'border-ml-yellow/40 bg-ml-yellow/90 text-neutral-950 shadow-[0_10px_24px_rgba(255,241,89,0.22)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {variant === 'success' && <Check className="h-3 w-3" />}
      {variant === 'warning' && <AlertTriangle className="h-3 w-3" />}
      {variant === 'danger' && <X className="h-3 w-3" />}
      {variant === 'info' && <Info className="h-3 w-3" />}
      {children}
    </div>
  );
}

export function BadgeConfianca({ score }: { score: number }) {
  if (score >= 85) return <Badge variant="success">{score}% · Alta confiança</Badge>;
  if (score >= 60) return <Badge variant="warning">{score}% · Confiança média</Badge>;
  return <Badge variant="danger">{score}% · Baixa confiança</Badge>;
}

export function BadgeLoading({ text = 'Processando...' }: { text?: string }) {
  return (
    <Badge variant="info">
      <Loader2 className="h-3 w-3 animate-spin" /> {text}
    </Badge>
  );
}
