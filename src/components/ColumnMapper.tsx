'use client';

import * as React from 'react';
import type { ColunaPlanilha, MapeamentoColunas } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Label } from './ui/Label';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { Check, Database, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  cabecalhos: string[];
  amostra: Record<string, string>[];
  value: MapeamentoColunas;
  onChange: (m: MapeamentoColunas) => void;
  onConfirmar: () => void;
  totalLinhas: number;
  nomeArquivo: string;
  disabled?: boolean;
};

const OPCOES_COLUNAS: Array<{ key: ColunaPlanilha; label: string; obrigatorio?: boolean; ajuda?: string }> = [
  { key: 'codigo', label: 'Número / Posição (coluna B)', obrigatorio: true, ajuda: 'Este NÚMERO aparece em destaque GIGANTE no resultado' },
  { key: 'enderecoCompleto', label: 'Endereço completo (coluna A)', ajuda: 'Rua, nº, bairro — tudo numa coluna só' },
  { key: 'logradouro', label: 'Apenas logradouro (Rua/Av...)' },
  { key: 'numero', label: 'Número do imóvel (separado)' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'estado', label: 'Estado / UF' },
  { key: 'cep', label: 'CEP' },
  { key: 'complemento', label: 'Complemento' },
];

export function ColumnMapper({
  cabecalhos,
  amostra,
  value,
  onChange,
  onConfirmar,
  totalLinhas,
  nomeArquivo,
  disabled,
}: Props) {
  const options = React.useMemo(
    () => ['', ...cabecalhos],
    [cabecalhos],
  );

  const autoMapearPadrao = () => {
    const col1 = cabecalhos[0];
    const col2 = cabecalhos[1];
    if (!col1 || !col2) return;
    const candidatosEndereco = cabecalhos.find((c) =>
      /endere|rua|av\.|aven|logradouro|estrada|rodovia|cep|local/i.test(c),
    );
    const candidatosCodigo = cabecalhos.find((c) =>
      /nume|cod|código|codigo|id|rota|nº|ordem|seq|posi[çc][aã]o/i.test(c),
    );
    onChange({
      enderecoCompleto: candidatosEndereco ?? col1,
      codigo: candidatosCodigo ?? col2,
    });
  };

  React.useEffect(() => {
    if (cabecalhos.length >= 2 && Object.keys(value).length === 0) {
      autoMapearPadrao();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cabecalhos.join('|')]);

  const codigoSel = Boolean(value.codigo);
  const enderecoSel = Boolean(
    value.enderecoCompleto || (value.logradouro && (value.numero || value.cep)),
  );
  const valido = Boolean(codigoSel && enderecoSel);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-ml-blue" />
          Mapear colunas da planilha
        </CardTitle>
        <p className="text-sm text-neutral-500">
          <span className="font-semibold text-neutral-700">{nomeArquivo}</span> · {totalLinhas} linhas
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-ml-yellow/70 bg-ml-yellow/15 p-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ml-yellow text-neutral-900">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[13.5px] font-bold text-neutral-900 leading-snug">
                  Formato recomendado: A=Endereço · B=Posição · C=Quantidade (opcional)
                </p>
                <p className="text-[12px] text-neutral-700 mt-0.5 leading-relaxed">
                  O sistema já detecta automaticamente colunas <b>Endereço</b> e <b>Posição</b>. Também suporta o formato antigo onde o número fica 1 linha ACIMA do endereço + linha "X unidades". Coluna Quantidade é ignorada.
                </p>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={autoMapearPadrao} disabled={disabled || cabecalhos.length < 2}>
              Aplicar padrão (A/B)
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {OPCOES_COLUNAS.map((op) => {
            const sel = value[op.key] ?? '';
            return (
              <div key={op.key}>
                <Label className={cn(op.obrigatorio && !sel && '!text-red-600')}>
                  {op.label}
                  {op.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Select
                  disabled={disabled}
                  value={sel}
                  onChange={(e) => onChange({ ...value, [op.key]: e.target.value || undefined })}
                >
                  {options.map((c, i) => (
                    <option key={i} value={c}>
                      {i === 0 ? '— Não usar —' : c}
                    </option>
                  ))}
                </Select>
                {op.ajuda && <p className="mt-1 text-[11px] text-neutral-500">{op.ajuda}</p>}
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5">
          <div className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-neutral-700">
            <Database className="h-4 w-4" /> Amostra ({amostra.length} linhas
          </div>
          <div className="overflow-x-auto scrollbar-thin -mx-1">
            <table className="min-w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-600">
                  <th className="px-2 py-1.5 font-medium">#</th>
                  {Object.keys(amostra[0] ?? {}).map((h) => (
                    <th
                      key={h}
                      className={cn(
                        'px-2 py-1.5 whitespace-nowrap font-medium',
                        Object.values(value).includes(h) && 'bg-ml-yellow/50 text-neutral-900',
                      )}
                    >
                      {h}
                      {Object.values(value).includes(h) && (
                        <Check className="ml-1 inline-block h-3 w-3 text-emerald-600" />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {amostra.map((linha, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0">
                    <td className="px-2 py-1.5 text-neutral-500">{i + 1}</td>
                    {Object.values(linha).map((v, j) => (
                      <td key={j} className="px-2 py-1.5 max-w-[200px] truncate text-neutral-800">
                        {v || <span className="text-neutral-400">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="text-[12.5px]">
            {valido ? (
              <p className="text-emerald-700 font-medium flex items-center gap-1.5">
                <Check className="h-4 w-4" /> Mapeamento válido. Pronto para importar.
              </p>
            ) : (
              <p className="text-amber-700 font-medium">
                É obrigatório: Código + Endereço completo OU Logradouro + (Nº ou CEP).
              </p>
            )}
          </div>
          <Button onClick={onConfirmar} disabled={!valido || disabled} size="lg" variant="primary">
            Importar {totalLinhas} endereços
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
