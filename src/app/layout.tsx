import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { ChatProvider } from '@/context/ChatContext';
import { LocationProvider } from '@/context/LocationContext';


import NotificationManager from '@/components/NotificationManager';

const notoSansKr = Noto_Sans_KR({
  weight: ['300', '400', '500', '700'], // Optimized weights
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
      <body className={notoSansKr.className}>
        <LocationProvider>
          <ChatProvider>
            <NotificationManager />
            <Header />
            <main>{children}</main>
            <BottomNav />
          </ChatProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
