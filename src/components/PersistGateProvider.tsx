'use client';

import * as React from 'react';
import { useSpreadsheetStore } from '@/stores/spreadsheetStore';
import { Loader2 } from 'lucide-react';

/**
 * Garante que:
 * 1) O Zustand persist terminou de carregar do storage (localStorage/mapa memória)
 *    ANTES de as páginas acessarem os dados do store.
 * 2) Resolve o problema clássico de "dados que somem ao navegar / recarregar".
 * 3) Evita crash de hydration ("This page couldn't load") pois os dados iniciais
 *    só aparecem no cliente (na tela inicial mostra loader breve).
 */
export function PersistGateProvider({ children }: { children: React.ReactNode }) {
  const rehydrated = useSpreadsheetStore((s) => s.__rehydrated);
  const [ok, setOk] = React.useState(false);
  const startTs = React.useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);

  React.useEffect(() => {
    let cancelled = false;

    const tentar = () => {
      try {
        const hasPersistApi = typeof (useSpreadsheetStore as unknown as { persist?: { hasHydrated?: boolean; rehydrate?: () => Promise<void> } }).persist !== 'undefined';
        const api = (useSpreadsheetStore as unknown as { persist?: { hasHydrated?: boolean; rehydrate?: () => Promise<void> } }).persist;
        if (hasPersistApi && api) {
          // zustand persist API
          if (api.hasHydrated) {
            useSpreadsheetStore.setState({ __rehydrated: true });
            setOk(true);
            return;
          }
          // reidrata e espera um frame
          void Promise.resolve(api.rehydrate?.()).then(() => {
            if (cancelled) return;
            useSpreadsheetStore.setState({ __rehydrated: true });
            // garante um microtick pra setState do zustand refletir
            queueMicrotask(() => {
              if (!cancelled) setOk(true);
            });
          });
          return;
        }

        // fallback: se não tiver api de persist, já está ok
        useSpreadsheetStore.setState({ __rehydrated: true });
        setOk(true);
      } catch {
        // nunca crashar por causa de storage
        useSpreadsheetStore.setState({ __rehydrated: true });
        setOk(true);
      }
    };

    // Se o onRehydrateStorage já setou __rehydrated, pula tudo
    if (rehydrated) {
      setOk(true);
      return;
    }

    tentar();

    // timeout de segurança (máx 500ms) — nunca trava a UI por causa do storage
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      useSpreadsheetStore.setState({ __rehydrated: true });
      setOk(true);
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rehydrated]);

  // Loader só mostra se passar de 80ms (evita flicker visual)
  const [mostrarLoader, setMostrarLoader] = React.useState(false);
  React.useEffect(() => {
    if (ok) return undefined;
    const t = window.setTimeout(() => setMostrarLoader(true), 80);
    return () => window.clearTimeout(t);
  }, [ok]);

  if (!ok) {
    if (!mostrarLoader) {
      // não mostra nada < 80ms
      return (
        <div className="min-h-[60vh]" aria-hidden="true" />
      );
    }
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center text-neutral-600">
          <Loader2 className="h-9 w-9 animate-spin text-ml-blue" />
          <p className="text-sm font-medium">Carregando dados locais…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
