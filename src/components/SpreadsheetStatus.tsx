'use client';

import * as React from 'react';
import { useSpreadsheetStore } from '@/stores/spreadsheetStore';
import { Card, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { Database, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatarData } from '@/lib/utils';

export function SpreadsheetStatus({ compact = false }: { compact?: boolean }) {
  const planilha = useSpreadsheetStore((s) => s.planilha);
  const total = useSpreadsheetStore((s) => s.totalRegistros());

  if (!planilha) {
    return (
      <Card className={compact ? '!rounded-2xl' : ''}>
        <CardContent className={compact ? '!p-4' : '!p-5'}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/12 text-amber-300 shadow-[0_10px_24px_rgba(245,158,11,0.18)]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-black tracking-tight text-white">Nenhuma planilha importada</p>
              {!compact && <p className="text-xs text-slate-400">Importe um arquivo XLSX para começar</p>}
            </div>
            <Badge variant="danger">Pendente</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={compact ? '!rounded-2xl' : ''}>
      <CardContent className={compact ? '!p-4' : '!p-5'}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-300 shadow-[0_10px_24px_rgba(16,185,129,0.18)]">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-black tracking-tight text-white">
            <FileSpreadsheet className="mr-1 inline h-4 w-4 -translate-y-0.5 text-ml-blue" />
            {planilha.nomeArquivo}
          </p>
          {!compact && (
            <p className="mt-0.5 text-xs text-slate-400">
              {formatarData(planilha.importadaEm)}
            </p>
          )}
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
            <Database className="h-3.5 w-3.5" />
            <span className="font-semibold">{total}</span> endereços carregados
          </p>
        </div>
        <Badge variant="success">Ativa</Badge>
      </div>
      </CardContent>
    </Card>
  );
}
