import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { ChatProvider } from '@/context/ChatContext';

const notoSansKr = Noto_Sans_KR({
  preload: false,
  weight: ['100', '300', '400', '500', '700', '900'],
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
        <ChatProvider>
          <Header />
          <main>{children}</main>
          <BottomNav />
        </ChatProvider>
      </body>
    </html>
  );
}
