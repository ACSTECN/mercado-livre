'use client';

import * as React from 'react';
import {
  BrowserMultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
} from '@zxing/library';
import {
  Camera as CamIcon,
  X,
  CheckCircle2,
  FlipVertical,
  RotateCw,
  AlertTriangle,
  QrCode,
} from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';

type Props = {
  onCodigoLido: (codigo: string, raw?: string) => void;
  onClose?: () => void;
  className?: string;
  autoStart?: boolean;
};

function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'
  );
}

import { normalizarCodigoPacote } from '@/lib/utils';

function extrairCodigoDoJson(raw: string): { codigo: string; tipo?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { codigo: '' };
  let tipoEncontrado: string | undefined;
  try {
    const obj = JSON.parse(trimmed);
    if (typeof obj === 'object' && obj !== null) {
      const entries = Object.entries(obj as Record<string, unknown>);
      const chavesCod = new Set(['id', 'codigo', 'code', 'cod', 'pacote', 'package', 'nfe', 'numero', 'number']);
      const chavesTipo = new Set(['t', 'type', 'tipo', 'tp']);
      for (const [k, v] of entries) {
        const kl = k.trim().toLowerCase();
        if (chavesTipo.has(kl) && typeof v === 'string') tipoEncontrado = v;
      }
      for (const [k, v] of entries) {
        const kl = k.trim().toLowerCase();
        if (chavesCod.has(kl) && v != null) {
          const c = normalizarCodigoPacote(String(v));
          if (c) return { codigo: c, tipo: tipoEncontrado };
        }
      }
      for (const [k, v] of entries) {
        const kl = k.trim().toLowerCase();
        if (!chavesTipo.has(kl)) {
          const c = normalizarCodigoPacote(String(v ?? ''));
          if (c) return { codigo: c, tipo: tipoEncontrado };
        }
      }
    }
  } catch {
    /* não é JSON válido, segue fallback */
  }
  const norm = normalizarCodigoPacote(trimmed);
  return { codigo: norm, tipo: tipoEncontrado };
}

export function QrCodeScanner({ onCodigoLido, onClose, className, autoStart = true }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const readerRef = React.useRef<BrowserMultiFormatReader | null>(null);
  const scanningRef = React.useRef(false);
  const ultimoLidoRef = React.useRef<{ codigo: string; ts: number } | null>(null);
  const frameTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ativo, setAtivo] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [inicializando, setInicializando] = React.useState(false);
  const [facing, setFacing] = React.useState<'environment' | 'user'>('environment');
  const [flashDetect, setFlashDetect] = React.useState(false);

  const parar = React.useCallback(() => {
    scanningRef.current = false;
    if (frameTimeoutRef.current) {
      clearTimeout(frameTimeoutRef.current);
      frameTimeoutRef.current = null;
    }
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch {
        /* noop */
      }
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        /* noop */
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        /* noop */
      }
      videoRef.current.srcObject = null;
    }
    setAtivo(false);
  }, []);

  const iniciar = React.useCallback(async () => {
    setErro(null);
    setInicializando(true);
    try {
      parar();
      if (typeof navigator === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
        setErro('Câmera indisponível neste navegador.');
        return;
      }
      if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && !isLocalhost()) {
        setErro('Câmera requer HTTPS. Acesse com https:// ou use leitor externo.');
        return;
      }

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.CODABAR,
        BarcodeFormat.ITF,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      readerRef.current = new BrowserMultiFormatReader(hints, 1500);

      const tentarAbrir = async (comAdvanced: boolean) => {
        const videoConstraints: MediaTrackConstraints = {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        };
        if (comAdvanced) {
          try {
            (videoConstraints as MediaTrackConstraints & { advanced?: unknown[] }).advanced = [
              { torch: true },
            ];
          } catch {
            /* noop */
          }
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => void 0);
        }
        setAtivo(true);
      };

      try {
        await tentarAbrir(true);
      } catch {
        await tentarAbrir(false);
      }

      scanningRef.current = true;
      const video = videoRef.current;
      if (!video) return;

      const processarFrame = async () => {
        if (!scanningRef.current) return;
        const v = videoRef.current;
        const r = readerRef.current;
        if (!v || !r || v.readyState < 2) {
          frameTimeoutRef.current = setTimeout(processarFrame, 100);
          return;
        }
        try {
          const res = await r.decodeFromVideoElement(v);
          if (res) {
            const raw = res.getText();
            const extraido = extrairCodigoDoJson(raw);
            const agora = Date.now();
            const ultimo = ultimoLidoRef.current;
            const duplicado =
              ultimo &&
              ultimo.codigo === extraido.codigo &&
              agora - ultimo.ts < 2500;
            if (!duplicado && extraido.codigo) {
              ultimoLidoRef.current = { codigo: extraido.codigo, ts: agora };
              setFlashDetect(true);
              setTimeout(() => setFlashDetect(false), 200);
              onCodigoLido(extraido.codigo, raw);
            }
          }
        } catch {
          /* sem leitura neste frame */
        }
        if (scanningRef.current) {
          frameTimeoutRef.current = setTimeout(processarFrame, 80);
        }
      };
      void processarFrame();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      const msgL = msg.toLowerCase();
      if (msgL.includes('permission') || msgL.includes('denied') || msgL.includes('permiss')) {
        setErro('Permissão da câmera negada. Autorize no navegador ou use leitor externo.');
      } else if (msgL.includes('notfound') || msgL.includes('not found') || msgL.includes('device')) {
        setErro('Nenhuma câmera detectada. Use leitor externo ou input manual.');
      } else if (msgL.includes('secure') || msgL.includes('https') || msgL.includes('insecure')) {
        setErro('Conexão precisa ser HTTPS. Use leitor externo.');
      } else {
        setErro('Não foi possível abrir a câmera. Tente leitor externo.');
      }
    } finally {
      setInicializando(false);
    }
  }, [facing, parar, onCodigoLido]);

  React.useEffect(() => {
    if (autoStart) {
      iniciar();
    }
    return () => parar();
  }, [iniciar, autoStart, parar]);

  return (
    <div className={cn('w-full overflow-hidden rounded-2xl border border-black/5 bg-neutral-900', className)}>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay={false}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-200',
            ativo ? 'opacity-100' : 'opacity-0',
            flashDetect && 'brightness-150',
          )}
        />

        {!ativo && !erro && !inicializando && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur">
              <QrCode className="h-8 w-8" />
            </div>
            <p className="max-w-xs text-[14px] font-medium text-white/80">
              Clique em &quot;Ligar câmera&quot; para apontar para o QR code ou código de barras
            </p>
          </div>
        )}

        {inicializando && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-sm">Inicializando scanner...</p>
          </div>
        )}

        {erro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center text-white">
            <AlertTriangle className="h-8 w-8 text-amber-300" />
            <p className="text-[14px] font-medium text-red-100 max-w-xs">{erro}</p>
          </div>
        )}

        {ativo && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[70%] w-[85%] rounded-2xl border-2 border-[#fff159]/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] animate-pulse-slow">
              <div className="absolute -top-1 -left-1 h-6 w-6 border-t-4 border-l-4 border-[#fff159] rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 h-6 w-6 border-t-4 border-r-4 border-[#fff159] rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-[#fff159] rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-[#fff159] rounded-br-xl" />
            </div>
          </div>
        )}

        {flashDetect && ativo && (
          <div className="absolute inset-0 bg-emerald-400/20 pointer-events-none animate-fade-out" />
        )}

        {(onClose || erro) && (
          <button
            type="button"
            onClick={() => {
              parar();
              onClose?.();
            }}
            className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
            aria-label="Fechar câmera"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 p-3 bg-neutral-950">
        {!ativo ? (
          <Button variant="primary" onClick={iniciar} className="h-12 min-w-[180px]">
            <CamIcon className="h-4 w-4" /> Ligar scanner
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="!bg-white/10 !text-white hover:!bg-white/20"
              onClick={() => {
                setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
                setTimeout(iniciar, 200);
              }}
              title="Trocar câmera"
            >
              <FlipVertical className="h-4 w-4" />
            </Button>
            <Button variant="success" size="lg" onClick={parar} className="min-w-[200px]">
              <CheckCircle2 className="h-5 w-5" /> Scanner ativo
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="!bg-white/10 !text-white hover:!bg-white/20"
              onClick={() => {
                parar();
                setTimeout(iniciar, 200);
              }}
              title="Reiniciar"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export { extrairCodigoDoJson };
