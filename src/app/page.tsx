'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import styles from './page.module.css';
import SplashScreen from '@/components/SplashScreen';

export default function Home() {
  const [searchValue, setSearchValue] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if splash has been shown this session? 
    // Usually splash is once per load. 
    // If user navigates back to home, should it show again? Maybe not.
    // For now, let's show it on mount.
    // Or we can use sessionStorage to show only once.
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');
    if (hasSeenSplash) {
      setShowSplash(false);
    }
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
    sessionStorage.setItem('hasSeenSplash', 'true');
  };

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/chat?q=${encodeURIComponent(searchValue)}`);
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.searchForm} onSubmit={handleSearch}>
        <div className={styles.searchBar}>
          <div className={styles.micIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14ZM11 5C11 4.45 11.45 4 12 4C12.55 4 13 4.45 13 5V11C13 11.55 12.55 12 12 12C11.45 12 11 11.55 11 11V5ZM19 11C19 14.87 15.87 18 12 18C8.13 18 5 14.87 5 11H3C3 15.53 6.39 19.36 10.74 19.91V23H13.26V19.91C17.61 19.36 21 15.53 21 11H19Z" fill="currentColor" />
            </svg>
          </div>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="무엇을 버리시나요? (예: 피자 박스)"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>
      </form>

      <section>
        <h2 className={styles.sectionTitle}>오늘의 우리 동네</h2>
        <div className={styles.infoCard}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 4H18V2H16V4H8V2H6V4H5C3.89 4 3 4.9 3 6V20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V10H19V20ZM19 8H5V6H19V8Z" fill="black" />
          </svg>
          <p>오늘은 <span className={styles.highlight}>재활용</span> 버리는 날입니다</p>
        </div>
      </section>

      <section className={styles.centerSection}>
        <div className={styles.bulbIcon}>
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 21C9 21.55 9.45 22 10 22H14C14.55 22 15 21.55 15 21V20H9V21ZM12 2C8.14 2 5 5.14 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.14 15.86 2 12 2ZM14.85 13.12L14 13.7V16H10V13.7L9.15 13.12C7.8 12.21 7 10.68 7 9C7 6.24 9.24 4 12 4C14.76 4 17 6.24 17 9C17 10.68 16.2 12.21 14.85 13.12Z" fill="black" />
            <path d="M12 1V3M4.22 4.22L5.64 5.64M18.36 5.64L19.78 4.22" stroke="black" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className={styles.faqTitle}>동네주민이 주로 묻는 것</h2>
        <div className={styles.faqList}>
          <div className={styles.faqItem}>
            <div className={styles.faqIconWrapper}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6H16C16 3.79 14.21 2 12 2C9.79 2 8 3.79 8 6H6C4.9 6 4 6.9 4 8V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8C20 6.9 19.1 6 18 6ZM12 4C13.1 4 14 4.9 14 6H10C10 4.9 10.9 4 12 4ZM18 20H6V8H8V10C8 10.55 8.45 11 9 11C9.55 11 10 10.55 10 10V8H14V10C14 10.55 14.45 11 15 11C15.55 11 16 10.55 16 10V8H18V20Z" fill="black" />
              </svg>
            </div>
            <p className={styles.faqText}>대형 폐기물 스티커는 어디서 사나요?</p>
          </div>
          <div className={styles.faqItem}>
            <div className={styles.faqIconWrapper}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 10V7C20 5.9 19.1 5 18 5H6C4.9 5 4 5.9 4 7V10C2.9 10 2 10.9 2 12V17H3.33L4 19H5L5.66 17H18.33L19 19H20L20.66 17H22V12C22 10.9 21.1 10 20 10ZM11 10H6V7H11V10ZM18 10H13V7H18V10Z" fill="black" />
              </svg>
            </div>
            <p className={styles.faqText}>매트리스 버리는 비용이 궁금해요</p>
          </div>
        </div>
      </section>
    </div>
  );
}
