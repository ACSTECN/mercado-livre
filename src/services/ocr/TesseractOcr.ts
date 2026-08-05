import { createWorker, type Worker } from 'tesseract.js';
import type { OcrProgresso, OcrResultado, OcrService } from '@/types';

export class TesseractOcrService implements OcrService {
  private worker: Worker | null = null;
  private lang = 'por+eng';

  async inicializar(onProgress?: (p: OcrProgresso) => void): Promise<Worker> {
    if (this.worker) return this.worker;
    onProgress?.({ status: 'inicializando', progresso: 5, mensagem: 'Carregando engine de OCR...' });
    this.worker = await createWorker(this.lang, 1, {
      logger: (m) => {
        if (m.status === 'loading tesseract core') {
          onProgress?.({ status: 'inicializando', progresso: 10 + Math.round(m.progress * 15), mensagem: 'Carregando núcleo Tesseract...' });
        } else if (m.status === 'initializing tesseract') {
          onProgress?.({ status: 'inicializando', progresso: 25 + Math.round(m.progress * 15), mensagem: 'Inicializando...' });
        } else if (m.status.startsWith('loading language')) {
          onProgress?.({ status: 'inicializando', progresso: 40 + Math.round(m.progress * 30), mensagem: 'Carregando dicionários português/inglês...' });
        } else if (m.status === 'recognizing text') {
          onProgress?.({ status: 'processando', progresso: 70 + Math.round(m.progress * 25), mensagem: 'Reconhecendo texto da etiqueta...' });
        }
      },
    });
    return this.worker;
  }

  async extrairTexto(
    imagem: File | string,
    onProgress?: (p: OcrProgresso) => void,
  ): Promise<OcrResultado> {
    onProgress?.({ status: 'carregando', progresso: 0, mensagem: 'Preparando imagem...' });
    try {
      const w = await this.inicializar(onProgress);
      const input = typeof imagem === 'string' ? imagem : imagem;
      const { data } = await w.recognize(input as never);
      onProgress?.({ status: 'concluido', progresso: 100, mensagem: 'Texto extraído com sucesso' });
      return {
        texto: data.text || '',
        confiancaMedia: data.confidence ?? 0,
      };
    } catch (e) {
      onProgress?.({
        status: 'erro',
        progresso: 0,
        mensagem: e instanceof Error ? e.message : 'Erro ao processar OCR',
      });
      throw e;
    }
  }

  async encerrar() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

let instanciaGlobal: TesseractOcrService | null = null;

export function getOcrService(): OcrService {
  const provider = process.env.NEXT_PUBLIC_OCR_PROVIDER ?? 'tesseract';
  if (provider === 'tesseract') {
    if (!instanciaGlobal) instanciaGlobal = new TesseractOcrService();
    return instanciaGlobal;
  }
  if (!instanciaGlobal) instanciaGlobal = new TesseractOcrService();
  return instanciaGlobal;
}
