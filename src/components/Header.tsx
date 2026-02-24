'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './Header.module.css';
import { useLocation } from '@/context/LocationContext';
import { useUser } from '@/context/UserContext';

export default function Header() {
  const { location, setLocation, detectLocation, isLoading, favorites, addFavorite, promoteFavorite } = useLocation();
  const { user } = useUser();
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);

  if (!user) return null;
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);
  const [bookmarkName, setBookmarkName] = useState('');

  const handleLocationClick = () => {
    setShowDetails(true);
    setIsAddingBookmark(false);
  };

  const handleFavoriteClick = (favName: string) => {
    // Promote this favorite to primary and update context
    promoteFavorite(favName);
    setShowDetails(false);

    // Force reload to sync all data fresh, similar to Settings page logic
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const handleAddBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (bookmarkName.trim()) {
      addFavorite(bookmarkName, location);
      setBookmarkName('');
      setIsAddingBookmark(false);
    }
  };

  const goToSettings = () => {
    setShowDetails(false);
    router.push('/settings');
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.location} onClick={handleLocationClick} role="button" tabIndex={0}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#27AE60" />
          </svg>
          <span className={styles.locationText}>{location}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: '4px', opacity: 0.5 }}>
            <path d="M7 10L12 15L17 10H7Z" fill="#333" />
          </svg>
        </div>


      </header>

      {showDetails && (
        <div className={styles.popoverOverlay} onClick={() => setShowDetails(false)}>
          <div className={styles.popoverContent} onClick={(e) => e.stopPropagation()}>

            <div className={styles.currentLocationSection}>
              <div className={styles.currentTitle}>현재 위치</div>
              <div className={styles.currentAddress}>
                {location}
              </div>
            </div>

            <div className={styles.favoritesSection}>
              <div className={styles.favoritesTitle}>
                <span>즐겨찾는 위치</span>
              </div>
              <div className={styles.favoriteList}>
                {favorites.length > 0 ? (
                  favorites.map((fav, idx) => (
                    <button
                      key={idx}
                      className={styles.favoriteChip}
                      onClick={() => handleFavoriteClick(fav.name)}
                    >
                      {fav.name === '우리집' ? '🏠' : fav.name === '회사' ? '🏢' : '📍'} {fav.name}
                    </button>
                  ))
                ) : (
                  <span style={{ color: '#999', fontSize: '0.9rem' }}>즐겨찾는 위치가 없습니다.</span>
                )}
              </div>
            </div>

            {isAddingBookmark ? (
              <form onSubmit={handleAddBookmark} className={styles.addBookmarkForm}>
                <input
                  className={styles.bookmarkInput}
                  placeholder="별칭 (예: 학교)"
                  value={bookmarkName}
                  onChange={(e) => setBookmarkName(e.target.value)}
                  autoFocus
                />
                <button type="submit" className={styles.saveBtn}>저장</button>
              </form>
            ) : (
              <div className={styles.actionButtons}>
                <button className={styles.secondaryBtn} onClick={() => setIsAddingBookmark(true)}>
                  ★ 현재 위치 즐겨찾기
                </button>
                <button className={styles.primaryBtn} onClick={goToSettings}>
                  설정으로 이동
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
