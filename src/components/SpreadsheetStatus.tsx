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
      <Card className={compact ? '!rounded-xl' : ''}>
        <CardContent className={compact ? '!p-3.5' : '!p-4'}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-neutral-800">Nenhuma planilha importada</p>
              {!compact && <p className="text-xs text-neutral-500">Importe um arquivo XLSX para começar</p>}
            </div>
            <Badge variant="danger">Pendente</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={compact ? '!rounded-xl' : ''}>
      <CardContent className={compact ? '!p-3.5' : '!p-4'}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-neutral-900">
            <FileSpreadsheet className="mr-1 inline h-4 w-4 -translate-y-0.5 text-ml-blue" />
            {planilha.nomeArquivo}
          </p>
          {!compact && (
            <p className="mt-0.5 text-xs text-neutral-500">
              {formatarData(planilha.importadaEm)}
            </p>
          )}
          <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-600">
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
