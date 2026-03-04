import type { Metadata, Viewport } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { ChatProvider } from '@/context/ChatContext';
import { LocationProvider } from '@/context/LocationContext';
import { UserProvider } from '@/context/UserContext';
import NotificationManager from '@/components/NotificationManager';
import Script from 'next/script';

const notoSansKr = Noto_Sans_KR({
  weight: ['300', '400', '500', '700'], // 최적화된 가중치
  subsets: ['latin'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '에코(Eco) - 똑똑한 분리배출',
  description: '우리 동네 분리배출 규칙부터 AI 품목 식별까지, 에코와 함께 시작하세요.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Eco',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9850273886039921"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
      </head>
      <body className={notoSansKr.className}>
        <LocationProvider>
          <UserProvider>
            <ChatProvider>
              <div className="mobile-app-layout">
                <NotificationManager />
                <Header />
                <main>{children}</main>
                <BottomNav />
              </div>
            </ChatProvider>
          </UserProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
