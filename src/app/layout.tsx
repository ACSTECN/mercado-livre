import type { Metadata, Viewport } from 'next';
import './globals.css';
import Link from 'next/link';
import { BarChart3, FileSearch, History, Home as HomeIcon, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersistGateProvider } from '@/components/PersistGateProvider';

export const metadata: Metadata = {
  title: 'Etiquetas ML — Leitor de Endereços',
  description:
    'Sistema para escanear etiquetas de entrega via OCR e encontrar o código correspondente na planilha importada.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#08111d',
};

const navItems = [
  { href: '/', label: 'Início', icon: HomeIcon },
  { href: '/importar', label: 'Planilha', icon: Upload },
  { href: '/escanear', label: 'Escanear', icon: FileSearch, destaque: true },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/historico', label: 'Histórico', icon: History },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col overflow-x-hidden">
        <PersistGateProvider>
          <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
            <div className="container-app">
              <div className="gradient-header relative overflow-hidden rounded-[1.75rem] border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-y-0 right-0 w-56 bg-[radial-gradient(circle_at_center,rgba(52,131,250,0.22),transparent_70%)]" />
                <div className="container-app">
                  <div className="flex items-center justify-between py-4">
                    <Link href="/" className="flex items-center gap-3 font-semibold text-[15px] text-white">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#fff159,#f5e100)] text-neutral-900 shadow-[0_10px_25px_rgba(255,241,89,0.28)]">
                        <FileSearch className="h-5 w-5" />
                      </span>
                      <div className="flex flex-col leading-tight">
                        <span className="tracking-tight text-[15px] sm:text-[17px] font-black">Etiquetas ML</span>
                        <span className="text-[11px] font-semibold text-slate-300">
                          OCR, conferência e operação logística
                        </span>
                      </div>
                    </Link>

                    <div className="hidden md:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]" />
                      Painel Unificado
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 container-app py-5 pb-36 sm:py-6 sm:pb-40">
            <div className="page-shell p-3 sm:p-4 lg:p-5">{children}</div>
          </main>

          <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom">
            <div className="container-app pb-3 sm:pb-4">
              <div className="mx-auto max-w-4xl rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,15,27,0.92),rgba(7,12,22,0.9))] px-2 py-2 shadow-[0_28px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
                <div className="grid grid-cols-5 gap-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 text-[11px] font-semibold text-slate-400 transition hover:bg-white/6 hover:text-white active:scale-[0.98]',
                        item.destaque && 'text-sky-300',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-11 w-11 items-center justify-center rounded-2xl border transition',
                          item.destaque
                            ? 'border-sky-400/30 bg-[linear-gradient(135deg,#3483fa,#6d5efc)] text-white shadow-[0_10px_25px_rgba(52,131,250,0.28)] group-hover:brightness-110'
                            : 'border-white/10 bg-white/5 text-slate-200 group-hover:border-white/20 group-hover:bg-white/10',
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="text-center leading-tight">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>
        </PersistGateProvider>
      </body>
    </html>
  );
}
