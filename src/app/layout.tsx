import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { ChatProvider } from '@/context/ChatContext';
import { LocationProvider } from '@/context/LocationContext';
import { UserProvider } from '@/context/UserContext';


import Script from 'next/script';

const notoSansKr = Noto_Sans_KR({
  weight: ['300', '400', '500', '700'], // 최적화된 가중치
  subsets: ['latin'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Eco Application',
  description: 'Neighborhood eco application',
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
          strategy="afterInteractive"
        />
      </head>
      <body className={notoSansKr.className}>
        <LocationProvider>
          <UserProvider>
            <ChatProvider>

              <Header />
              <main>{children}</main>
              <BottomNav />
            </ChatProvider>
          </UserProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
