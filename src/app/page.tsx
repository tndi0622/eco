'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { useLocation } from '@/context/LocationContext';
import { useUser } from '@/context/UserContext';

const SplashScreen = dynamic(() => import('@/components/SplashScreen'), { ssr: false });
const Onboarding = dynamic(() => import('@/components/Onboarding'), { ssr: false });
import AdBanner from '@/components/AdBanner';

export default function Home() {
  const [showSplash, setShowSplash] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const { location } = useLocation();
  const { user, loginWithGoogle } = useUser();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 스플래시 상태 확인
    const hasSeenSplash = localStorage.getItem('hasSeenSplash');
    // 온보딩 상태 확인
    const hasOnboarded = localStorage.getItem('hasOnboarded');

    if (user && !hasOnboarded) {
      localStorage.setItem('hasOnboarded', 'true');
    }

    if (hasSeenSplash) {
      setShowSplash(false);
      if (!hasOnboarded && !user) setShowOnboarding(true);
    } else {
      setShowSplash(true);
      if (!hasOnboarded && !user) {
        setTimeout(() => setShowOnboarding(true), 2500);
      }
    }
  }, [user]);

  const handleOnboardingComplete = () => {
    localStorage.setItem('hasOnboarded', 'true');
    setShowOnboarding(false);
  };

  const handleSplashFinish = () => {
    setShowSplash(false);
    localStorage.setItem('hasSeenSplash', 'true');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        try {
          sessionStorage.setItem('pendingImage', base64);
          router.push('/chat');
        } catch (err) {
          console.error('Local Storage Error', err);
          alert('이미지가 너무 큽니다. 더 작은 이미지를 선택해주세요.');
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/chat?q=${encodeURIComponent(searchInput)}`);
    }
  };

  const handleVoiceSearch = () => {
    router.push('/chat?mode=voice');
  };

  const largeWasteExamples = [
    { name: '매트리스', icon: '🛏️' },
    { name: '소파', icon: '🛋️' },
    { name: '책상', icon: '📝' },
    { name: '냉장고', icon: '❄️' },
    { name: '자전거', icon: '🚲' },
    { name: '캐리어', icon: '🧳' }
  ];

  if (showSplash === null) return <div className={styles.containerMinimal} style={{ display: 'none' }} aria-hidden="true" />;

  if (showSplash) {
    return (
      <>
        <div className={styles.containerMinimal} style={{ display: 'none' }} aria-hidden="true" />
        <SplashScreen onFinish={handleSplashFinish} />
      </>
    );
  }

  if (showOnboarding) {
    return (
      <>
        <div className={styles.containerMinimal} style={{ display: 'none' }} aria-hidden="true" />
        <Onboarding onComplete={handleOnboardingComplete} />
      </>
    );
  }

  if (!user) {
    return (
      <div className={styles.loginOverlay}>
        <div className={styles.loginContent}>
          <div className={styles.loginLogo}>♻️</div>
          <h2 className={styles.loginTitle}>에코 시작하기</h2>
          <p className={styles.loginDesc}>
            대형폐기물 배출 고민을 한 번에 해결하세요!<br />
            가구, 가전 수수료 정보를 바로 알려드려요.
          </p>
          <button className={styles.googleLoginBtn} onClick={loginWithGoogle}>
            <svg className={styles.googleIconSvg} viewBox="0 0 24 24" width="20" height="20">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
            </svg>
            구글로 로그인하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.containerMinimal}>
      <div className={styles.contentWrapper}>
        <section className={styles.heroEntry}>
          <img src="/images/eco_mascot_idea.png" alt="Mascot" className={styles.heroMascot} />
          <h1 className={styles.heroTitleMinimal}>
            대형폐기물,<br />
            <span className={styles.highlight}>어떻게 버릴까요?</span>
          </h1>

          <form onSubmit={handleSearch} className={styles.searchFormMinimal}>
            <button type="button" className={styles.iconBtnLeft} onClick={() => fileInputRef.current?.click()}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
            </button>
            <input type="text" className={styles.inputMinimal} placeholder="가구나 가전제품 이름을 입력하세요" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            <button type="button" className={styles.iconBtnRight} onClick={handleVoiceSearch}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </button>
            <button type="submit" className={styles.searchBtnMinimal}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </form>

          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handlePhotoUpload} />
        </section>

        <section className={styles.recommendSection}>
          <div className={styles.recommendTitle}>
            <span>자주 찾는 대형폐기물 🔎</span>
          </div>
          <div className={styles.chipContainer}>
            {largeWasteExamples.map((item, idx) => (
              <button
                key={idx}
                className={styles.chip}
                onClick={() => router.push(`/chat?q=${encodeURIComponent(item.name)}`)}
              >
                <span>{item.icon}</span> {item.name}
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginTop: '30px' }}>
          <div style={{ fontSize: '0.7rem', color: '#ccc', textAlign: 'center', marginBottom: '4px' }}>ADVERTISEMENT</div>
          <AdBanner dataAdSlot="YOUR_AD_SLOT_ID" />
        </section>
      </div>
    </div>
  );
}
