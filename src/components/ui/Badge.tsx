import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, AlertTriangle, X, Info, Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-neutral-200 bg-neutral-100 text-neutral-800',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        warning: 'border-amber-200 bg-amber-50 text-amber-700',
        danger: 'border-red-200 bg-red-50 text-red-700',
        info: 'border-blue-200 bg-blue-50 text-blue-700',
        primary: 'border-ml-yellow/60 bg-ml-yellow/70 text-neutral-900',
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
