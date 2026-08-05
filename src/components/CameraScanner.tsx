'use client';

import * as React from 'react';
import { Camera, RotateCw, FlipVertical, X, CheckCircle2, Camera as CamIcon } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';

type Props = {
  onFoto: (dataUrl: string, file: File) => void;
  onClose?: () => void;
  className?: string;
};

export function CameraScanner({ onFoto, onClose, className }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [ativo, setAtivo] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [inicializando, setInicializando] = React.useState(false);
  const [facing, setFacing] = React.useState<'environment' | 'user'>('environment');

  const parar = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setAtivo(false);
  }, []);

  const iniciar = React.useCallback(async () => {
    setErro(null);
    setInicializando(true);
    try {
      parar();
      const videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: facing },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      };
      try {
        (videoConstraints as unknown as { advanced: unknown[] }).advanced = [
          { torch: true },
        ];
      } catch {
        /* noop */
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
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Erro desconhecido';
      if (msg.includes('Permission')) {
        setErro('Permissão da câmera negada. Autorize o acesso ou escolha "Fazer upload'.slice(0,90));
      } else if (msg.includes('NotFound') || msg.includes('not found')) {
        setErro('Nenhuma câmera encontrada no dispositivo');
      } else {
          setErro('Não foi possível abrir a câmera. Tente fazer upload da imagem.');
      }
    } finally {
      setInicializando(false);
    }
  }, [facing, parar]);

  const capturar = React.useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `etiqueta_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const reader = new FileReader();
        reader.onload = () => {
          onFoto(String(reader.result), file);
        };
        reader.readAsDataURL(file);
      },
      'image/jpeg',
      0.92,
    );
  }, [onFoto]);

  React.useEffect(() => {
    return () => parar();
  }, [parar]);

  return (
    <div className={cn('w-full overflow-hidden rounded-2xl border border-black/5 bg-neutral-900', className)}>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn('h-full w-full object-cover', ativo ? 'animate-fade-in' : 'opacity-0')}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!ativo && !erro && !inicializando && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur">
            <CamIcon className="h-8 w-8" />
          </div>
          <p className="max-w-xs text-[14px] font-medium text-white/80">
            Clique em "Ligar câmera" para apontar para a etiqueta
          </p>
        </div>
        )}
        {inicializando && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-sm">Inicializando câmera...</p>
        </div>
        )}
        {erro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center text-white">
          <p className="text-[14px] font-medium text-red-200">{erro}</p>
        </div>
        )}
        {ativo && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[70%] w-[85%] rounded-2xl border-2 border-[#fff159]/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
              <div className="absolute -top-1 -left-1 h-6 w-6 border-t-4 border-l-4 border-[#fff159] rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 h-6 w-6 border-t-4 border-r-4 border-[#fff159] rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-[#fff159] rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-[#fff159] rounded-br-xl" />
            </div>
          </div>
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
            <Camera className="h-4.5 h-4 w-4" /> Ligar câmera
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="icon" className="!bg-white/10 !text-white hover:!bg-white/20" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}>
              <FlipVertical className="h-4 w-4" />
            </Button>
            <Button variant="success" size="lg" onClick={capturar} disabled={!ativo} className="min-w-[200px]">
              <CheckCircle2 className="h-5 w-5" /> Capturar foto
            </Button>
            <Button variant="ghost" size="icon" className="!bg-white/10 !text-white hover:!bg-white/20" onClick={parar}>
              <RotateCw className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
