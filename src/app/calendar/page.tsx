'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { useLocation } from '@/context/LocationContext';


const dayMap: { [key: string]: number } = {
    '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6,
    '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3, '목요일': 4, '금요일': 5, '토요일': 6
};

export default function Calendar() {
    const [viewDate, setViewDate] = useState(new Date());
    const [today, setToday] = useState<Date | null>(null);
    const [holidays, setHolidays] = useState<any[]>([]);
    const { location } = useLocation();

    // Default Schedule (Fallback)
    const defaultSchedule: { [key: number]: string } = {
        0: '배출 없음',
        1: '일반쓰레기, 음식물',
        2: '종이, 플라스틱',
        3: '캔, 고철, 유리',
        4: '비닐, 스티로폼',
        5: '투명 페트병 (별도 배출!)',
        6: '배출 없음'
    };

    const [dischargeSchedule, setDischargeSchedule] = useState<{ [key: number]: string }>(defaultSchedule);
    const [isApiLoading, setIsApiLoading] = useState(false);

    // Parse Helper
    const parseRulesToSchedule = (rules: any[]) => {
        // Use Sets to automatically deduplicate items for each day
        const dailySets = Array.from({ length: 7 }, () => new Set<string>());

        rules.forEach(rule => {
            // Helper to add items to the Set for specific days
            const addItems = (dayStr: string, itemType: string) => {
                if (!dayStr) return;

                // standard keys check
                Object.keys(dayMap).forEach(key => {
                    if (dayStr.includes(key)) {
                        const idx = dayMap[key];
                        dailySets[idx].add(itemType);
                    }
                });

                // "everyday" check
                if (dayStr.includes('매일')) {
                    for (let i = 0; i < 7; i++) {
                        dailySets[i].add(itemType);
                    }
                }
            };

            addItems(rule.gnrlWsteDschrgDay, '일반쓰레기');
            addItems(rule.foodWsteDschrgDay, '음식물');
            addItems(rule.recycleDschrgDay, '재활용');
        });

        // Convert Sets to formatted strings
        const newSchedule: { [key: number]: string } = {};
        for (let i = 0; i < 7; i++) {
            if (dailySets[i].size > 0) {
                newSchedule[i] = Array.from(dailySets[i]).join(', ');
            } else {
                newSchedule[i] = '배출 없음 (미수거일)';
            }
        }

        return newSchedule;
    };

    useEffect(() => {
        setToday(new Date());

        // Prefer saved schedule? Or refresh from API?
        // If user has location, try API first.
        if (location && location !== '위치 설정이 필요합니다') {
            const fetchRules = async () => {
                setIsApiLoading(true);
                const parts = location.split(' ');
                const sido = parts[0];
                const sigungu = parts[1];

                if (sido && sigungu) {
                    try {
                        const res = await fetch(`/api/waste-rules?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}`);
                        const data = await res.json();
                        if (data.rules && data.rules.length > 0) {
                            const newSched = parseRulesToSchedule(data.rules);
                            setDischargeSchedule(newSched);
                            // Save to local storage to persist recent auto-fetch
                            localStorage.setItem('ecoDischargeSchedule', JSON.stringify(newSched));
                        } else {
                            // console.log("No specific rules found, using default or saved");
                            loadSaved();
                        }
                    } catch (e) {
                        loadSaved();
                    } finally {
                        setIsApiLoading(false);
                    }
                } else {
                    loadSaved();
                    setIsApiLoading(false);
                }
            };
            fetchRules();
        } else {
            loadSaved();
        }
    }, [location]);

    const loadSaved = () => {
        const saved = localStorage.getItem('ecoDischargeSchedule');
        if (saved) {
            try {
                setDischargeSchedule(JSON.parse(saved));
            } catch (e) { }
        }
    };

    // Derived State
    const todayDayIndex = today ? today.getDay() : 0;
    const dischargeInfo = dischargeSchedule[todayDayIndex] || '배출 없음';

    useEffect(() => {
        const fetchHolidays = async () => {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth() + 1;
            try {
                const res = await fetch(`/api/holidays?year=${year}&month=${month}`);
                const data = await res.json();
                if (data.holidays) {
                    setHolidays(prev => {
                        const newHolidays = data.holidays.filter((newH: any) =>
                            !prev.some(existing => existing.date === newH.date)
                        );
                        return [...prev, ...newHolidays];
                    });
                }
            } catch (err) {
                // console.error("Failed to fetch holidays", err);
            }
        };

        fetchHolidays();
    }, [viewDate]);

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
        return new Date(year, month, 1).getDay();
    };

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const calendarDays = [];
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

    const isToday = (day: number) => {
        if (!today) return false;
        return (
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        );
    };

    const isHoliday = (day: number) => {
        if (!day) return false;
        const dayStr = String(day).padStart(2, '0');
        const monthStr = String(month + 1).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;
        return holidays.some(h => h.date === dateStr);
    };

    const getDayClass = (date: number | null, index: number) => {
        if (!date) return styles.empty;
        const colIndex = index % 7;
        const isSunday = colIndex === 0;
        const isSaturday = colIndex === 6;
        const isPublicHoliday = isHoliday(date);
        let className = styles.day;
        if (isToday(date)) className += ` ${styles.active}`;
        if (isPublicHoliday) className += ` ${styles.holidayText}`;
        else if (isSunday) className += ` ${styles.sunday}`;
        else if (isSaturday) className += ` ${styles.saturday}`;
        return className;
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];



    return (
        <div className={styles.container}>

            {/* 1. Eco Point / Gamification Dashboard */}


            {/* History Modal (Simple Inline Expand for now or absolute overlay) */}


            {/* 1. Today's Local Discharge Rule (Location Based + Manual Override) */}
            <section className={styles.localAlert}>
                <div className={styles.alertIcon}>📢</div>
                <div className={styles.alertContent}>
                    <div className={styles.alertTitle}>
                        오늘 <strong>{location}</strong> 배출 품목
                    </div>
                    <div className={styles.alertText}>
                        {isApiLoading ? '정보를 불러오는 중...' : dischargeInfo}
                    </div>
                </div>
            </section>

            {/* 3. Calendar */}
            <div className={styles.calendarCard}>
                <div className={styles.header}>
                    <button onClick={handlePrevMonth} className={styles.navBtn}>&lt;</button>
                    <span>{year} {monthNames[month]}</span>
                    <button onClick={handleNextMonth} className={styles.navBtn}>&gt;</button>
                </div>
                <div className={styles.grid}>
                    {days.map((day, index) => (
                        <div
                            key={day}
                            className={`${styles.dayName} ${index === 0 ? styles.sunday : ''} ${index === 6 ? styles.saturday : ''}`}
                        >
                            {day}
                        </div>
                    ))}
                    {calendarDays.map((date, index) => (
                        <div key={index} className={getDayClass(date, index)}>
                            {date}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
