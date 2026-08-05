import type { Metadata, Viewport } from 'next';
import './globals.css';
import Link from 'next/link';
import { FileSearch, History, Home as HomeIcon, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  themeColor: '#fff159',
};

const navItems = [
  { href: '/', label: 'Início', icon: HomeIcon },
  { href: '/importar', label: 'Planilha', icon: Upload },
  { href: '/escanear', label: 'Escanear', icon: FileSearch, destaque: true },
  { href: '/historico', label: 'Histórico', icon: History },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 border-b border-black/5 gradient-header shadow-sm">
          <div className="container-app flex items-center justify-between py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold text-[15px] text-neutral-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 text-[#fff159] shadow-sm">
                <FileSearch className="h-5 w-5" />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="tracking-tight">Etiquetas ML</span>
                <span className="text-[11px] font-medium text-neutral-700">
                  OCR + Consulta de rotas
                </span>
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 container-app py-4 pb-28">{children}</main>

        <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-black/5 bg-white/90 backdrop-blur-lg safe-bottom">
          <div className="container-app grid grid-cols-4 gap-1 py-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium text-neutral-600 transition hover:bg-neutral-100 active:scale-[0.98]',
                  item.destaque && 'text-blue-700',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full transition',
                    item.destaque
                      ? 'bg-ml-blue text-white shadow-md shadow-blue-500/30 group-hover:bg-blue-600'
                      : 'bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200',
                  )}
                >
                  <item.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </body>
    </html>
  );
}
