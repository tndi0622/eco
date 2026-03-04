'use client';


import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './page.module.css';
import { useLocation } from '@/context/LocationContext';
import { useUser } from '@/context/UserContext';
import { compressImage } from '@/lib/utils';

const SplashScreen = dynamic(() => import('@/components/SplashScreen'), { ssr: false });
const Onboarding = dynamic(() => import('@/components/Onboarding'), { ssr: false });
import AdBanner from '@/components/AdBanner';

export default function Home() {
  const [showSplash, setShowSplash] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchPlaceholder, setSearchPlaceholder] = useState('예: 깨진 유리, 매트리스');
  const { location } = useLocation();
  const { user, loginWithGoogle } = useUser();
  const router = useRouter();

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem('hasOnboarded', 'true');
    setShowOnboarding(false);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('Photo upload started:', file.name, file.size, file.type);
      setIsProcessing(true);
      try {
        // 사진 찍기의 경우 용량이 매우 클 수 있으므로 압축 후 저장
        // File 객체를 직접 전달하여 메모리 효율성 개선
        console.log('Compressing image...');
        const compressedBase64 = await compressImage(file);
        console.log('Compression complete. Base64 length:', compressedBase64.length);

        try {
          localStorage.setItem('pendingImage', compressedBase64);
          console.log('Saved to localStorage successfully. Redirecting to /chat...');
          router.push('/chat');
        } catch (storageErr) {
          console.error('LocalStorage Save Error (Quota exceeded?):', storageErr);
          alert('사진 용량이 너무 커서 임시 저장에 실패했습니다. 사진 품질을 조절하거나 다시 시도해 주세요.');
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Photo Process/Compress Error:', err);
        alert('이미지를 처리하는 중 오류가 발생했습니다: ' + (err as Error).message);
        setIsProcessing(false);
      }
    }
    e.target.value = '';
  }, [router]);


  useEffect(() => {
    // 스플래시와 온보딩 로직 통합 관리
    const hasSeenSplash = localStorage.getItem('hasSeenSplash');
    const hasOnboarded = localStorage.getItem('hasOnboarded');

    // 이미 로그인된 경우 온보딩 처리
    if (user && !hasOnboarded) {
      localStorage.setItem('hasOnboarded', 'true');
    }

    if (hasSeenSplash) {
      setShowSplash(false);
      if (!hasOnboarded && !user) setShowOnboarding(true);
    } else {
      setShowSplash(true);
    }
  }, [user]);

  // 위치 알림 및 토스트 로직 최적화
  useEffect(() => {
    if (!location || location === '위치 설정이 필요합니다') {
      setShowLocationPrompt(true);
      const timer = setTimeout(() => {
        setShowToast(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setShowLocationPrompt(false);
      setShowToast(false);
    }
  }, [location]);

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
    localStorage.setItem('hasSeenSplash', 'true');
    const hasOnboarded = localStorage.getItem('hasOnboarded');
    if (!hasOnboarded && !user) {
      setShowOnboarding(true);
    }
  }, [user]);

  const handleVoiceSearch = useCallback(() => {
    router.push('/chat?mode=voice');
  }, [router]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/chat?q=${encodeURIComponent(searchInput.trim())}`);
    }
  }, [searchInput, router]);

  // 위치 알림 및 토스트 상태
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // 위치 상태 감시 효과
  useEffect(() => {
    if (!location || location === '위치 설정이 필요합니다') {
      setShowLocationPrompt(true);
      const timer = setTimeout(() => {
        setShowToast(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setShowLocationPrompt(false);
      setShowToast(false);
    }
  }, [location]);

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
            우리 동네 배출 일정을 확인하고<br />
            분리배출 고민을 한 번에 해결하세요!
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
          <img src="/images/eco_mascot_question.png" alt="Mascot" className={styles.heroMascot} />
          <h1 className={styles.heroTitleMinimal}>
            버리기 헷갈릴 때,<br />
            <span className={styles.highlight}>바로 알려드려요</span>
          </h1>

          {showLocationPrompt && (
            <div style={{ fontSize: '0.85rem', color: '#ff5252', marginTop: '-0.5rem', marginBottom: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div className={styles.locationPrompt}></div>
              지금 위치를 설정해보세요!
            </div>
          )}

          <form onSubmit={handleSearch} className={styles.searchFormMinimal}>
            <button type="button" className={styles.iconBtnLeft} onClick={() => {
              console.log('Mobile Bridge: Photo button clicked');
              fileInputRef.current?.click();
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
            </button>
            <input type="text" className={styles.inputMinimal} placeholder={searchPlaceholder} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
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

          {/* 검색어 섹션 제거됨 */}

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{
              display: 'none'
            }}
            onChange={(e) => {
              console.log('Mobile Bridge: Input context onChange triggered');
              handlePhotoUpload(e);
            }}
          />
        </section>


        {/* 광고 섹션 예시 (실제 슬롯 ID가 생기면 dataAdSlot을 수정해 주세요) */}
        <section style={{ marginTop: '30px' }}>
          <div style={{ fontSize: '0.7rem', color: '#ccc', textAlign: 'center', marginBottom: '4px' }}>ADVERTISEMENT</div>
          <AdBanner dataAdSlot="YOUR_AD_SLOT_ID" />
        </section>
      </div>

      <div className={`${styles.toast} ${showToast ? styles.show : ''}`} onClick={() => router.push('/settings')}>
        <div className={styles.toastContent}>
          <span className={styles.toastIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </span>
          <span className={styles.toastText}>동네를 설정하면 배출요일을 알려드려요!</span>
        </div>
        <button className={styles.toastClose} onClick={(e) => { e.stopPropagation(); setShowToast(false); }}>×</button>
      </div>
      {isProcessing && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner}></div>
          <p>사진을 분석하기 위해 준비 중입니다...</p>
        </div>
      )}
    </div>
  );
}
