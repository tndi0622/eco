'use client';


import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { useLocation } from '@/context/LocationContext';

const SplashScreen = dynamic(() => import('@/components/SplashScreen'), { ssr: false });
const Onboarding = dynamic(() => import('@/components/Onboarding'), { ssr: false });

export default function Home() {
  const [showSplash, setShowSplash] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchPlaceholder, setSearchPlaceholder] = useState('예: 깨진 유리, 매트리스');
  const { location, coordinates } = useLocation();
  const router = useRouter();

  const handleOnboardingComplete = () => {
    localStorage.setItem('hasOnboarded', 'true');
    setShowOnboarding(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recent Search Logic
  const RECOMMENDED_KEYWORDS = ['깨진 유리', '아이스팩', '프라이팬', '폐의약품', '건전지'];
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveRecentSearch = (term: string) => {
    let newHistory = [term, ...recentSearches.filter(k => k !== term)];
    if (newHistory.length > 5) newHistory = newHistory.slice(0, 5);
    setRecentSearches(newHistory);
    localStorage.setItem('recentSearches', JSON.stringify(newHistory));
  };

  const deleteRecentSearch = (term: string) => {
    const newHistory = recentSearches.filter(k => k !== term);
    setRecentSearches(newHistory);
    localStorage.setItem('recentSearches', JSON.stringify(newHistory));
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
    // reset
    e.target.value = '';
  };

  const [todayRecycleStatus, setTodayRecycleStatus] = useState<{
    status: 'loading' | 'success' | 'error' | 'empty';
    message: string;
    items?: string;
    time?: string;
  }>({ status: 'loading', message: '정보를 불러오는 중...' });

  useEffect(() => {
    // Check Splash Status
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');

    // Check Onboarding Status
    const hasOnboarded = localStorage.getItem('hasOnboarded');

    if (hasSeenSplash) {
      setShowSplash(false);
      if (!hasOnboarded) setShowOnboarding(true);
    } else {
      setShowSplash(true);
      // Wait for splash animation (2.5s) then show onboarding if needed
      if (!hasOnboarded) {
        setTimeout(() => {
          setShowOnboarding(true);
        }, 2500);
      }
    }
  }, []);

  // Placeholder Logic
  useEffect(() => {
    setSearchPlaceholder('배출 방법이 궁금한 물품을 입력해 주세요');
  }, []);

  // Fetch Today's Recycle Info based on Location
  // Fetch Today's Recycle Info based on Location
  useEffect(() => {
    const fetchTodayRecycleInfo = async () => {
      // If location isn't set yet or invalid
      if (!location || location === '위치 설정이 필요합니다' || location === '위치 파악 실패') {
        setTodayRecycleStatus({
          status: 'error',
          message: '위치를 설정하면 알려드려요'
        });
        return;
      }

      const parts = location.split(' ');
      const sido = parts[0];
      const sigungu = parts[1];
      const dong = parts[2]; // Can be undefined

      // Need at least sido/sigungu
      if (!sido || !sigungu) {
        setTodayRecycleStatus({
          status: 'error',
          message: '위치 정보가 불확실해요'
        });
        return;
      }

      try {
        setTodayRecycleStatus({ status: 'loading', message: '정보 확인 중...' });

        const query = `/api/waste-rules?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}&dong=${encodeURIComponent(dong || '')}`;
        const res = await fetch(query);

        if (!res.ok) throw new Error('Network response was not ok');

        const data = await res.json();

        if (data.rules && data.rules.length > 0) {
          // Logic to determine today's discharge based on rules
          const dayMap: { [key: number]: string } = { 0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토' };
          const todayDay = new Date().getDay(); // 0-6
          const todayChar = dayMap[todayDay]; // '일', '월', ...

          let todayItems: string[] = [];
          let timeInfo = '';

          data.rules.forEach((rule: any) => {
            const isToday = (dayStr: string) => dayStr && (dayStr.includes(todayChar) || dayStr.includes('매일'));

            if (isToday(rule.gnrlWsteDschrgDay)) {
              todayItems.push('일반쓰레기');
              if (!timeInfo && rule.gnrlWsteDschrgTime) timeInfo = rule.gnrlWsteDschrgTime;
            }
            if (isToday(rule.foodWsteDschrgDay)) {
              todayItems.push('음식물');
              if (!timeInfo && rule.foodWsteDschrgTime) timeInfo = rule.foodWsteDschrgTime;
            }
            if (isToday(rule.recycleDschrgDay)) {
              todayItems.push('재활용');
              if (!timeInfo && rule.recycleDschrgTime) timeInfo = rule.recycleDschrgTime;
            }
          });

          // Deduplicate
          todayItems = [...new Set(todayItems)];

          if (todayItems.length > 0) {
            setTodayRecycleStatus({
              status: 'success',
              message: '오늘 배출 가능',
              items: todayItems.join(', '),
              time: timeInfo ? timeInfo.replace('~', ' ~ ') : '18:00 ~ 24:00'
            });
          } else {
            setTodayRecycleStatus({
              status: 'empty',
              message: '오늘은 배출일이 아닙니다'
            });
          }
        } else {
          // Fallback for demo if no rules found
          setTodayRecycleStatus({
            status: 'error', // Treating 'no rules' as a soft error/info provided default
            message: '관할 구청 데이터 없음',
            items: '기본 정보 참고',
            time: '18:00 ~ 24:00'
          });
        }
      } catch (error) {
        console.error("Failed to fetch waste rules", error);
        setTodayRecycleStatus({
          status: 'error',
          message: '정보를 불러올 수 없어요'
        });
      }
    };

    fetchTodayRecycleInfo();
  }, [location]);

  // ... (useLocation effect) ...



  // Location Prompt & Toast Logic
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    // Check if location is set
    // We consider '위치 설정이 필요합니다' or null as not set
    if (!location || location === '위치 설정이 필요합니다') {
      setShowLocationPrompt(true);
      // Show toast after a small delay
      const timer = setTimeout(() => {
        setShowToast(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setShowLocationPrompt(false);
      setShowToast(false);
    }
  }, [location]);

  const handleSplashFinish = () => {
    setShowSplash(false);
    sessionStorage.setItem('hasSeenSplash', 'true');
  };

  // If status is null (initializing), render a hidden div to use the styles prevents preload warning
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


  const handleVoiceSearch = () => {
    // Redirect to chat with voice mode trigger (optional implementation in chat page)
    // or just simple redirect for now where user can press mic there
    router.push('/chat?mode=voice');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      saveRecentSearch(searchInput.trim());
      router.push(`/chat?q=${encodeURIComponent(searchInput)}`);
    }
  };


  return (
    <div className={styles.containerMinimal}>
      <div className={styles.contentWrapper}>
        {/* 1. Hero Entry Section */}
        <section className={styles.heroEntry}>
          <img
            src="/images/eco_mascot_question.png"
            alt="Questioning Eco Mascot"
            className={styles.heroMascot}
          />
          <h1 className={styles.heroTitleMinimal}>
            버리기 헷갈릴 때,<br />
            <span className={styles.highlight}>바로 알려드려요</span>
          </h1>

          {/* Location Prompt Text (Optional: Insert if you want it near title) */}
          {showLocationPrompt && (
            <div style={{ fontSize: '0.85rem', color: '#ff5252', marginTop: '-0.5rem', marginBottom: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div className={styles.locationPrompt}></div>
              지금 위치를 설정해보세요!
            </div>
          )}

          <form onSubmit={handleSearch} className={styles.searchFormMinimal}>
            {/* Left: Camera Button */}
            <button
              type="button"
              className={styles.iconBtnLeft}
              onClick={() => fileInputRef.current?.click()}
              title="사진으로 찾기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
            </button>

            <input
              type="text"
              className={styles.inputMinimal}
              placeholder={searchPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />

            {/* Right: Voice & Search Buttons */}
            {/* Mic Button */}
            <button
              type="button"
              className={styles.iconBtnRight}
              onClick={handleVoiceSearch}
              title="음성으로 찾기"
            >
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

          {/* 1.5 Recent & Recommended Chips */}
          <div className={styles.recommendSection}>
            {recentSearches.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div className={styles.recommendTitle}>
                  최근 검색어
                  <span style={{ cursor: 'pointer', fontSize: '0.75rem' }} onClick={() => { localStorage.removeItem('recentSearches'); setRecentSearches([]); }}>전체삭제</span>
                </div>
                <div className={styles.chipContainer}>
                  {recentSearches.map((term, idx) => (
                    <div key={idx} className={`${styles.chip} ${styles.recent}`} onClick={() => router.push(`/chat?q=${encodeURIComponent(term)}`)}>
                      {term}
                      <button className={styles.chipDelete} onClick={(e) => { e.stopPropagation(); deleteRecentSearch(term); }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.recommendTitle}>추천 검색어</div>
            <div className={styles.chipContainer}>
              {RECOMMENDED_KEYWORDS.map((keyword, idx) => (
                <div key={idx} className={styles.chip} onClick={() => router.push(`/chat?q=${encodeURIComponent(keyword)}`)}>
                  {keyword}
                </div>
              ))}
            </div>
          </div>



          {/* Hidden File Input */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handlePhotoUpload}
          />

        </section>

        {/* 2. Today's Discharge (Context) */}
        <section className={styles.todayContext}>
          <div className={styles.contextLabel}>오늘의 배출</div>

          {todayRecycleStatus.status === 'loading' && (
            <div className={styles.contextValue} style={{ color: '#999' }}>정보를 불러오는 중...</div>
          )}

          {todayRecycleStatus.status === 'success' && (
            <>
              <div className={styles.contextValue}>{todayRecycleStatus.items}</div>
              <div className={styles.contextTime}>{todayRecycleStatus.time}</div>
            </>
          )}

          {todayRecycleStatus.status === 'empty' && (
            <div className={styles.contextValue} style={{ color: '#666' }}>{todayRecycleStatus.message}</div>
          )}

          {todayRecycleStatus.status === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className={styles.contextValue} style={{ color: '#FF5252', fontSize: '1rem' }}>
                {todayRecycleStatus.message}
              </div>
              {todayRecycleStatus.items && (
                <div style={{ fontSize: '0.8rem', color: '#999' }}>{todayRecycleStatus.items}</div>
              )}
            </div>
          )}
        </section>
      </div>


      {/* Toast Notification */}
      <div className={`${styles.toast} ${showToast ? styles.show : ''}`} onClick={() => router.push('/settings')}>
        <div className={styles.toastContent}>
          <span className={styles.toastIcon}>📍</span>
          <span className={styles.toastText}>동네를 설정하면 배출요일을 알려드려요!</span>
        </div>
        <button className={styles.toastClose} onClick={(e) => { e.stopPropagation(); setShowToast(false); }}>×</button>
      </div>
    </div >
  );
}
