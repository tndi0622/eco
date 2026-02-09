'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import styles from './page.module.css';
import SplashScreen from '@/components/SplashScreen';
import { useLocation } from '@/context/LocationContext';
import EcoDashboard from '@/components/EcoDashboard';

export default function Home() {
  const [showSplash, setShowSplash] = useState<boolean | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchPlaceholder, setSearchPlaceholder] = useState('예: 깨진 유리, 매트리스');
  const { location, coordinates } = useLocation();
  const router = useRouter();

  const [todayRecycleInfo, setTodayRecycleInfo] = useState('정보를 불러오는 중...');
  const [todayRecycleTime, setTodayRecycleTime] = useState('');

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

  // Randomize placeholder on mount
  useEffect(() => {
    const examples = [
      '예: 깨진 유리, 깨진 그릇',
      '예: 아이스팩, 보냉가방',
      '예: 매트리스, 대형 가구',
      '예: 유통기한 지난 약',
      '예: 프라이팬, 냄비',
      '예: 형광등, 건전지'
    ];
    // Select one random example on mount/refresh
    const randomIndex = Math.floor(Math.random() * examples.length);
    setSearchPlaceholder(examples[randomIndex]);
  }, []);

  // Fetch Today's Recycle Info based on Location
  // Fetch Today's Recycle Info based on Location
  useEffect(() => {
    const fetchTodayRecycleInfo = async () => {
      // If location isn't set yet or invalid
      if (!location || location === '위치 설정이 필요합니다' || location === '위치 파악 실패') {
        setTodayRecycleInfo('위치를 설정해주세요');
        setTodayRecycleTime('');
        return;
      }

      const parts = location.split(' ');
      const sido = parts[0];
      const sigungu = parts[1];
      const dong = parts[2]; // Can be undefined

      // Need at least sido/sigungu
      if (!sido || !sigungu) {
        setTodayRecycleInfo('위치 정보 확인 필요');
        setTodayRecycleTime('');
        return;
      }

      try {
        const query = `/api/waste-rules?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}&dong=${encodeURIComponent(dong || '')}`;
        const res = await fetch(query);
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
            setTodayRecycleInfo(todayItems.join(', '));
            // Set time info if found, else default
            setTodayRecycleTime(timeInfo ? timeInfo.replace('~', ' ~ ') : '18:00 ~ 24:00');
          } else {
            setTodayRecycleInfo('오늘은 배출일이 아닙니다');
            setTodayRecycleTime('');
          }
        } else {
          setTodayRecycleInfo('데이터 없음 (기본값 사용)');
          setTodayRecycleTime('18:00 ~ 24:00');
        }
      } catch (error) {
        console.error("Failed to fetch waste rules", error);
        setTodayRecycleInfo('정보 조회 실패');
        setTodayRecycleTime('');
      }
    };

    fetchTodayRecycleInfo();
  }, [location]);

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



  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/chat?q=${encodeURIComponent(searchInput)}`);
    }
  };


  return (
    <div className={styles.containerMinimal}>
      <div className={styles.contentWrapper}>
        {/* 1. Hero Entry Section */}
        <section className={styles.heroEntry}>
          <h1 className={styles.heroTitleMinimal}>
            버리기 헷갈릴 때,<br />
            <span className={styles.highlight}>바로 알려드려요</span>
          </h1>

          <form onSubmit={handleSearch} className={styles.searchFormMinimal}>
            <input
              type="text"
              className={styles.inputMinimal}
              placeholder={searchPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className={styles.searchBtnMinimal}>
              🔎
            </button>
          </form>
          <div className={styles.helperTextMinimal}>혹은 카메라로 찍어서 물어보세요 📸</div>

          <button className={styles.photoBtnMinimal} onClick={() => router.push('/chat')}>
            사진으로 찾기
          </button>
        </section>

        {/* 2. Today's Discharge (Context) */}
        <section className={styles.todayContext}>
          <div className={styles.contextLabel}>오늘의 배출</div>
          <div className={styles.contextValue}>{todayRecycleInfo}</div>
          <div className={styles.contextTime}>{todayRecycleTime}</div>
        </section>
      </div>

      {/* Footer Navigation (Hidden/Implicit or handled by Layout) */}
    </div>
  );
}
