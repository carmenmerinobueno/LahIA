import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';
import { CookieBanner } from '@/components/CookieBanner';
import { SITE_URL } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Somos LahIA · Agencia y academia de IA', template: '%s · Somos LahIA' },
  description: 'Automatizamos lo que te roba horas y te enseñamos a dominar la inteligencia artificial.',
  openGraph: { siteName: 'Somos LahIA', locale: 'es_ES', type: 'website' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: '#0e0507', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600&family=Inter:wght@400;500&family=Dancing+Script:wght@600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <a className="sr" href="#contenido">Saltar al contenido</a>
        <Nav />
        <main id="contenido">{children}</main>
        <footer className="foot">
          <div className="wrap">
            <span>© {new Date().getFullYear()} Somos LahIA</span>
            <nav aria-label="Legal">
              <a href="/legal/aviso-legal">Aviso legal</a>
              <a href="/legal/privacidad">Privacidad</a>
              <a href="/legal/cookies">Cookies</a>
              <a href="/legal/condiciones">Condiciones</a>
            </nav>
          </div>
        </footer>
        <CookieBanner />
      </body>
    </html>
  );
}
