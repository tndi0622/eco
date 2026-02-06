'use client';

import { useState } from 'react';
import styles from './Header.module.css';
import { useLocation } from '@/context/LocationContext';
import AddressSearch from './AddressSearch';

export default function Header() {
  const { location, setLocation, detectLocation, isLoading } = useLocation();
  const [showSearch, setShowSearch] = useState(false);

  // Toggle Address Search Modal
  const handleLocationClick = () => {
    setShowSearch(true);
  };

  const handleAddressComplete = (addr: string) => {
    setLocation(addr);
    setShowSearch(false);
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.location} onClick={handleLocationClick} style={{ cursor: 'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#27AE60" />
          </svg>
          <span className={styles.locationText}>{location}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: '4px', opacity: 0.5 }}>
            <path d="M7 10L12 15L17 10H7Z" fill="#333" />
          </svg>
        </div>

        <button className={styles.refresh} onClick={(e) => { e.stopPropagation(); detectLocation(); }} disabled={isLoading} aria-label="현재 위치 재탐색">
          {isLoading ? (
            <div className={styles.spinner}></div>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" fill="#333" />
            </svg>
          )}
        </button>
      </header>

      {showSearch && (
        <AddressSearch
          onComplete={handleAddressComplete}
          onClose={() => setShowSearch(false)}
        />
      )}
    </>
  );
}
