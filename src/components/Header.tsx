'use client';

import { useState, useEffect } from 'react';
import styles from './Header.module.css';
import { useLocation } from '@/context/LocationContext';

export default function Header() {
  const { location, setLocation, detectLocation, isLoading } = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const startEditing = () => {
    setEditValue(location);
    setIsEditing(true);
    setSuggestions([]);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isEditing && editValue.length > 1) {
        fetchSuggestions(editValue);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [editValue, isEditing]);

  const fetchSuggestions = async (query: string) => {
    try {
      // Search within Korea
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&countrycodes=kr&limit=5`);
      const data = await res.json();
      setSuggestions(data);
      setShowSuggestions(true);
    } catch (err) {
      console.error(err);
    }
  };

  const selectSuggestion = (item: any) => {
    // Format address simple
    let addr = "";
    if (item.address) {
      const city = item.address.city || item.address.town || item.address.county || "";
      const district = item.address.suburb || item.address.borough || item.address.neighbourhood || "";
      const road = item.address.road || "";
      addr = `${city} ${district} ${road}`.trim();
      if (!addr) addr = item.display_name.split(",")[0];
    } else {
      addr = item.display_name;
    }

    setLocation(addr);
    setIsEditing(false);
    setShowSuggestions(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editValue.trim()) {
      setLocation(editValue);
      setIsEditing(false);
    }
  };

  // Re-import React hooks if missing (already imported in prev file context)
  // Actually, importing useEffect is needed.

  return (
    <header className={styles.header}>
      {isEditing ? (
        <div className={styles.editWrapper}>
          <form onSubmit={handleSave} className={styles.editForm}>
            <input
              autoFocus
              className={styles.input}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="동네 이름 검색 (예: 삼성동)"
            />
            <button type="button" onClick={() => setIsEditing(false)} className={styles.cancelBtn}>취소</button>
          </form>
          {showSuggestions && suggestions.length > 0 && (
            <ul className={styles.suggestionList}>
              {suggestions.map((item, idx) => (
                <li key={idx} onClick={() => selectSuggestion(item)} className={styles.suggestionItem}>
                  {item.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className={styles.location} onClick={startEditing} style={{ cursor: 'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#27AE60" />
          </svg>
          <span>{location}</span>
        </div>
      )}

      {!isEditing && (
        <button className={styles.refresh} onClick={detectLocation} disabled={isLoading}>
          {isLoading ? (
            <div className={styles.spinner}></div>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4.01 7.58 4.01 12C4.01 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 14 14.61 14 12 14" stroke="none" />
              {/* Replaced with a simpler refresh icon logic or just use existing path correctly */}
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4.01 7.58 4.01 12C4.01 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z" fill="black" />
            </svg>
          )}
        </button>
      )}
    </header>
  );
}
