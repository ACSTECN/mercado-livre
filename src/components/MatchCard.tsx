'use client';

import * as React from 'react';
import type { ResultadoMatch } from '@/types';
import { Card, CardContent } from './ui/Card';
import { BadgeConfianca } from './ui/Badge';
import { Button } from './ui/Button';
import { Check, Copy, MapPin } from 'lucide-react';
import { cn, copiarParaAreaTransferencia } from '@/lib/utils';

export function MatchCard({
  item,
  selecionado,
  onSelecionar,
  onCopiar,
  destacado = false,
}: {
  item: ResultadoMatch;
  selecionado?: boolean;
  onSelecionar?: () => void;
  onCopiar?: (codigo: string) => void;
  destacado?: boolean;
}) {
  const [copiado, setCopiado] = React.useState(false);
  const r = item.registro;
  const endereco = [
    r.logradouro,
    r.numero ? `, ${r.numero}` : '',
    r.complemento ? ` - ${r.complemento}` : '',
    r.bairro ? `, ${r.bairro}` : '',
    r.cidade ? ` - ${r.cidade}` : '',
    r.estado ? `/${r.estado}` : '',
    r.cep ? ` · CEP ${r.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}` : '',
  ]
    .filter(Boolean)
    .join('')
    .trim();

  const copiar = async () => {
    await copiarParaAreaTransferencia(r.codigo);
    setCopiado(true);
    onCopiar?.(r.codigo);
    setTimeout(() => setCopiado(false), 1600);
  };

  const Wrapper: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({ children, onClick, className }) =>
    onClick ? (
      <button type="button" onClick={onClick} className={cn('w-full text-left', className)}>
        {children}
      </button>
    ) : (
      <div className={className}>{children}</div>
    );

  return (
    <Wrapper
      onClick={onSelecionar}
      className={cn(
        onSelecionar && 'transition hover:-translate-y-0.5')}
    >
      <Card
        className={cn(
          'relative overflow-hidden transition',
          selecionado && 'ring-2 ring-ml-blue/70',
          destacado && 'gradient-card',
        )}
      >
        <CardContent className="!p-4 sm:!p-5">
          <div className="flex items-start gap-4">
            <div className="flex min-w-[74px] flex-col items-center gap-2">
              <div
                className={cn(
                  'flex h-[74px] w-full items-center justify-center rounded-xl font-black text-[28px] leading-none',
                  destacado
                    ? 'bg-gradient-to-br from-ml-yellow to-[#fde640] text-neutral-900 shadow-premium'
                    : 'bg-neutral-100 text-neutral-800',
                )}
              >
                <span className="truncate px-2 tabular-nums">{r.codigo}</span>
              </div>
              <Button
                size="sm"
                variant={copiado ? 'success' : 'secondary'}
                onClick={(e) => {
                  e.stopPropagation();
                  copiar();
                }}
                className="w-full h-8"
              >
                {copiado ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </>
                )}
              </Button>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-neutral-500">
                  <MapPin className="h-3.5 w-3.5" /> Endereço
                </div>
                <BadgeConfianca score={item.score} />
              </div>
              <p className="text-[14.5px] leading-snug text-neutral-800 break-words">
                {endereco || r.enderecoCompleto || '(sem endereço)'}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {item.scoreDetalhado && (
                  <>
                    <Chip label="CEP" value={Math.round(item.scoreDetalhado.cep * 100)} />
                    <Chip label="Nº" value={Math.round(item.scoreDetalhado.numero * 100)} />
                    <Chip label="Rua" value={Math.round(item.scoreDetalhado.logradouro * 100)} />
                    <Chip label="Bairro" value={Math.round(item.scoreDetalhado.bairro * 100)} />
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        {selecionado && (
          <div className="absolute top-3 right-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ml-blue text-white">
              <Check className="h-3.5 w-3.5" />
            </div>
          </div>
        )}
      </Card>
    </Wrapper>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  const color =
    value >= 85 ? 'bg-emerald-50 text-emerald-700' : value >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold', color)}>
      {label} {value}%
    </span>
  );
}
