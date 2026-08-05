'use client';

import * as React from 'react';
import type { EnderecoEstruturado } from '@/types';
import { Label } from './ui/Label';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { PencilLine, RotateCcw } from 'lucide-react';
import { Button } from './ui/Button';

type Props = {
  value: EnderecoEstruturado;
  onChange: (e: EnderecoEstruturado) => void;
  onCancelarEdicao?: () => void;
  modoEdicao?: boolean;
};

const CAMPOS: Array<{
  key: keyof EnderecoEstruturado; label: string; placeholder?: string; inputmode?: 'numeric' | 'text'; wide?: boolean; uppercase?: boolean
}> = [
  { key: 'logradouro', label: 'Logradouro (Rua / Av.)', placeholder: 'Rua das Flores', wide: true },
  { key: 'numero', label: 'Número', placeholder: '100', inputmode: 'numeric' },
  { key: 'complemento', label: 'Complemento', placeholder: 'Apto 25, Bloco C' },
  { key: 'bairro', label: 'Bairro', placeholder: 'Centro' },
  { key: 'cidade', label: 'Cidade', placeholder: 'São Paulo' },
  { key: 'estado', label: 'UF', placeholder: 'SP' },
  { key: 'cep', label: 'CEP', placeholder: '01001000', inputmode: 'numeric' },
];

export function AddressForm({ value, onChange, onCancelarEdicao, modoEdicao = true }: Props) {
  const update = (k: keyof EnderecoEstruturado, v: string) => onChange({ ...value, [k]: v });
  return (
    <Card>
      <CardHeader className="!pb-3">
        <CardTitle className="text-[16px] flex items-center gap-2">
          <PencilLine className="h-4.5 h-4 w-4 text-ml-blue" />
          {modoEdicao ? 'Corrigir endereço identificado' : 'Endereço identificado'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CAMPOS.map((c) => (
            <div key={c.key} className={c.wide ? 'sm:col-span-2' : ''}>
              <Label htmlFor={`f_${c.key}`}>{c.label}</Label>
              <Input
                id={`f_${c.key}`}
                value={value[c.key]}
                placeholder={c.placeholder}
                disabled={!modoEdicao}
                className={!modoEdicao ? '!bg-neutral-50 !text-neutral-700' : ''}
                inputMode={c.inputmode}
                onChange={(e) =>
                  update(c.key, c.uppercase ? e.target.value.toUpperCase() : e.target.value)
                }
              />
            </div>
          ))}
        </div>
        {modoEdicao && onCancelarEdicao && (
          <div className="mt-4 flex justify-end">
            <Button size="sm" variant="ghost" onClick={onCancelarEdicao}>
              <RotateCcw className="h-3.5 w-3.5" /> Descartar alterações
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
