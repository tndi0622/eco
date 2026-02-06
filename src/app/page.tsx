'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import styles from './page.module.css';
import SplashScreen from '@/components/SplashScreen';
import { useLocation } from '@/context/LocationContext';
import ChatbotButton from '@/components/ChatbotButton';
import EcoDashboard from '@/components/EcoDashboard';

export default function Home() {
  const [showSplash, setShowSplash] = useState<boolean | null>(null);
  const { location, coordinates } = useLocation();
  const router = useRouter();

  useEffect(() => {
    // Check if splash has been shown this session
    // We check this inside useEffect to ensure client-side execution
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');
    if (hasSeenSplash) {
      setShowSplash(false);
    } else {
      setShowSplash(true);
    }
  }, []);

  // ... (useLocation effect) ...



  const handleSplashFinish = () => {
    setShowSplash(false);
    sessionStorage.setItem('hasSeenSplash', 'true');
  };

  // If status is null (initializing), render nothing or loading to prevent flash
  if (showSplash === null) return null;

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <div className={styles.container}>
      {/* 1. Eco Dashboard (Moved to top) */}
      <EcoDashboard />

      {/* 2. FAQ Section (Moved down) */}
      <section className={styles.centerSection}>
        <div className={styles.bulbIcon}>
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 21C9 21.55 9.45 22 10 22H14C14.55 22 15 21.55 15 21V20H9V21ZM12 2C8.14 2 5 5.14 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.14 15.86 2 12 2ZM14.85 13.12L14 13.7V16H10V13.7L9.15 13.12C7.8 12.21 7 10.68 7 9C7 6.24 9.24 4 12 4C14.76 4 17 6.24 17 9C17 10.68 16.2 12.21 14.85 13.12Z" fill="black" />
            <path d="M12 1V3M4.22 4.22L5.64 5.64M18.36 5.64L19.78 4.22" stroke="black" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className={styles.faqTitle}>동네주민이 주로 묻는 것</h2>
        <div className={styles.faqList}>
          <div className={styles.faqItem} onClick={() => router.push(`/chat?q=${encodeURIComponent('대형 폐기물 스티커는 어디서 사나요?')}`)} style={{ cursor: 'pointer' }}>
            <div className={styles.faqIconWrapper}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6H16C16 3.79 14.21 2 12 2C9.79 2 8 3.79 8 6H6C4.9 6 4 6.9 4 8V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8C20 6.9 19.1 6 18 6ZM12 4C13.1 4 14 4.9 14 6H10C10 4.9 10.9 4 12 4ZM18 20H6V8H8V10C8 10.55 8.45 11 9 11C9.55 11 10 10.55 10 10V8H14V10C14 10.55 14.45 11 15 11C15.55 11 16 10.55 16 10V8H18V20Z" fill="black" />
              </svg>
            </div>
            <p className={styles.faqText}>대형 폐기물 스티커는 어디서 사나요?</p>
          </div>
          <div className={styles.faqItem} onClick={() => router.push(`/chat?q=${encodeURIComponent('매트리스 버리는 비용이 궁금해요')}`)} style={{ cursor: 'pointer' }}>
            <div className={styles.faqIconWrapper}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 10V7C20 5.9 19.1 5 18 5H6C4.9 5 4 5.9 4 7V10C2.9 10 2 10.9 2 12V17H3.33L4 19H5L5.66 17H18.33L19 19H20L20.66 17H22V12C22 10.9 21.1 10 20 10ZM11 10H6V7H11V10ZM18 10H13V7H18V10Z" fill="black" />
              </svg>
            </div>
            <p className={styles.faqText}>매트리스 버리는 비용이 궁금해요</p>
          </div>
        </div>
      </section>

      <ChatbotButton />
    </div>
  );
}
