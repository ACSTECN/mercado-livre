'use client';

import * as React from 'react';
import { Upload, Image as ImgIcon, X } from 'lucide-react';
import { cn, lerArquivoComoDataUrl } from '@/lib/utils';
import { Button } from './ui/Button';

type Props = {
  onSelecionado: (dataUrl: string, file: File) => void;
  className?: string;
  compacto?: boolean;
};

export function ImageUploader({ onSelecionado, className, compacto }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [drag, setDrag] = React.useState(false);

  const aoSelecionar = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return;
    const url = await lerArquivoComoDataUrl(f);
    onSelecionado(url, f);
  };

  if (compacto) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => aoSelecionar(e.target.files)}
        />
        <Button variant="secondary" onClick={() => inputRef.current?.click()} className="!h-12 min-w-[200px]">
          <Upload className="h-4 w-4" /> Escolher foto da galeria
        </Button>
      </>
    );
  }

  return (
    <div
      className={cn(
        'relative w-full rounded-2xl border-2 border-dashed p-6 text-center transition cursor-pointer',
        drag
          ? 'border-ml-blue bg-blue-50/60'
          : 'border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50',
        className,
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        aoSelecionar(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => aoSelecionar(e.target.files)}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ml-yellow/30 text-neutral-900">
          <Upload className="h-6 w-6" />
        </div>
        <div className="space-y-0.5">
          <p className="text-[14.5px] font-semibold text-neutral-800">
            Solte uma imagem ou toque para selecionar
          </p>
          <p className="text-xs text-neutral-500">PNG, JPG, WEBP — boa qualidade e foco</p>
        </div>
        <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
          <ImgIcon className="h-4 w-4" /> Escolher imagem
        </Button>
      </div>
    </div>
  );
}

export function ImagemPreview({
  src,
  onRemover,
  onRefazer,
  className,
}: {
  src: string;
  onRemover?: () => void;
  onRefazer?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('relative w-full overflow-hidden rounded-2xl border border-black/5', className)}>
      <img src={src} alt="Etiqueta" className="h-full max-h-[420px] w-full object-contain bg-neutral-100" />
      {(onRemover || onRefazer) && (
        <div className="absolute top-3 right-3 flex gap-2">
          {onRemover && (
            <button
              type="button"
              onClick={onRemover}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
              aria-label="Remover"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {onRefazer && (
        <div className="absolute bottom-3 left-3">
          <Button size="sm" variant="secondary" onClick={onRefazer}>
        Refazer foto
      </Button>
        </div>
      )}
    </div>
  );
}
