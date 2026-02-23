'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { useLocation } from '@/context/LocationContext';
import { useUser } from '@/context/UserContext';

// Simple Toggle Component
const Toggle = ({ active, onClick }: { active: boolean, onClick: () => void }) => (
    <div className={`${styles.toggle} ${active ? styles.active : ''}`} onClick={onClick}>
        <div className={styles.slider} />
    </div>
);


const dayMap: { [key: string]: number } = {
    '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6,
    '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3, '목요일': 4, '금요일': 5, '토요일': 6
};

export default function Calendar() {
    const [viewDate, setViewDate] = useState(new Date());
    const [today, setToday] = useState<Date | null>(null);
    const [holidays, setHolidays] = useState<any[]>([]);
    const { location } = useLocation();
    const { isSubscribed } = useUser();

    // Notification State
    const [notificationSettings, setNotificationSettings] = useState({
        general: false,
        recycle: false,
        food: false
    });

    useEffect(() => {
        const saved = localStorage.getItem('notificationSettings');
        if (saved) setNotificationSettings(JSON.parse(saved));
    }, []);

    const handleToggleNotification = (key: keyof typeof notificationSettings) => {
        if (!isSubscribed) {
            alert('배출 알림은 프리미엄 멤버십 전용 기능입니다. ✨');
            return;
        }
        const next = { ...notificationSettings, [key]: !notificationSettings[key] };
        setNotificationSettings(next);
        localStorage.setItem('notificationSettings', JSON.stringify(next));
    };

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
    const [dischargeTime, setDischargeTime] = useState('18:00 ~ 24:00'); // Default time
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
                const dong = parts[2];

                if (sido && sigungu) {
                    try {
                        const res = await fetch(`/api/waste-rules?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}&dong=${encodeURIComponent(dong || '')}`);
                        const data = await res.json();
                        if (data.rules && data.rules.length > 0) {
                            const newSched = parseRulesToSchedule(data.rules);
                            setDischargeSchedule(newSched);

                            // Extract time info
                            let timeInfo = '';
                            // Try to find a valid time from any rule
                            const timeRule = data.rules.find((r: any) => r.gnrlWsteDschrgTime || r.recycleDschrgTime || r.foodWsteDschrgTime);
                            if (timeRule) {
                                timeInfo = timeRule.gnrlWsteDschrgTime || timeRule.recycleDschrgTime || timeRule.foodWsteDschrgTime;
                            }
                            const formattedTime = timeInfo ? timeInfo.replace('~', ' ~ ') : '18:00 ~ 24:00';
                            setDischargeTime(formattedTime);

                            // Save to local storage to persist recent auto-fetch
                            localStorage.setItem('ecoDischargeSchedule', JSON.stringify(newSched));
                            localStorage.setItem('ecoDischargeTime', formattedTime);
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
        const savedTime = localStorage.getItem('ecoDischargeTime');
        if (saved) {
            try {
                setDischargeSchedule(JSON.parse(saved));
            } catch (e) { }
        }
        if (savedTime) {
            setDischargeTime(savedTime);
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

    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [selectedSchedule, setSelectedSchedule] = useState('');

    // ... (keep existing useEffect for location and API)

    // Helper to check if a date is selected
    const isSelected = (day: number) => {
        if (!selectedDate || !day) return false;
        return (
            day === selectedDate.getDate() &&
            month === selectedDate.getMonth() &&
            year === selectedDate.getFullYear()
        );
    };

    const handleDateClick = (day: number) => {
        if (!day) return;
        const newDate = new Date(year, month, day);
        setSelectedDate(newDate);

        // Update selected schedule info
        const dayOfWeek = newDate.getDay();
        setSelectedSchedule(dischargeSchedule[dayOfWeek] || '배출 없음');
    };

    // Helper to get icons/dots for calendar grid
    const getDayContent = (day: number) => {
        if (!day) return null;
        const currentLoopDate = new Date(year, month, day);
        const dayOfWeek = currentLoopDate.getDay();
        const info = dischargeSchedule[dayOfWeek];

        let dotColor = '#ddd'; // Default no discharge
        if (info.includes('일반')) dotColor = '#27AE60'; // Green
        else if (info.includes('재활용')) dotColor = '#F2994A'; // Orange
        else if (info.includes('배출 없음')) dotColor = 'transparent';

        return (
            <div className={styles.dayContent}>
                <span className={styles.dayNumber}>{day}</span>
                {dotColor !== 'transparent' && <div className={styles.dot} style={{ backgroundColor: dotColor }}></div>}
            </div>
        );
    };

    return (
        <div className={styles.container}>
            {/* 1. Calendar Header & Grid */}
            <div className={styles.calendarCard}>
                <div className={styles.header}>
                    <button onClick={handlePrevMonth} className={styles.navBtn}>&lt;</button>
                    <span className={styles.monthTitle}>{year}년 {month + 1}월</span>
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
                        <div
                            key={index}
                            className={`${styles.day} ${isToday(date as number) ? styles.today : ''} ${isSelected(date as number) ? styles.selected : ''}`}
                            onClick={() => handleDateClick(date as number)}
                        >
                            {getDayContent(date as number)}
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Action Card (Selected Date Info) */}
            <section className={styles.actionCard}>
                <div className={styles.actionHeader}>
                    {selectedDate && (
                        <div className={styles.selectedDateDisplay}>
                            {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({['일', '월', '화', '수', '목', '금', '토'][selectedDate.getDay()]})
                            {isToday(selectedDate.getDate()) && selectedDate.getMonth() === new Date().getMonth() && <span className={styles.todayBadge}>TODAY</span>}
                        </div>
                    )}
                </div>

                <div className={styles.scheduleInfo}>
                    <div className={styles.infoLabel}>배출 가능 품목</div>
                    <div className={styles.infoValue}>{selectedSchedule || dischargeSchedule[new Date().getDay()]}</div>
                </div>

                <div className={styles.metaInfo}>
                    <span>⏰ {dischargeTime}</span>
                    <span>📍 {location.split(' ')[1] || '위치 미설정'} 기준</span>
                </div>

                <div className={styles.buttonGroup}>
                    {selectedSchedule.includes('대형') && (
                        <button className={styles.callBtn}>
                            📞 대형폐기물 신청
                        </button>
                    )}
                </div>

                {/* Notification Settings Embedded in Calendar */}
                <div className={styles.notiSection}>
                    <div className={styles.notiHeader}>맞춤 알림 설정</div>
                    <div className={styles.notificationList}>
                        <div className={styles.notificationItem}>
                            <div className={styles.notiInfo}>
                                <div className={styles.notiLabel}>일반쓰레기 알림</div>
                                <div className={styles.notiDesc}>배출 당일 오전 9시 알림</div>
                            </div>
                            <Toggle active={notificationSettings.general} onClick={() => handleToggleNotification('general')} />
                        </div>
                        <div className={styles.notificationItem}>
                            <div className={styles.notiInfo}>
                                <div className={styles.notiLabel}>재활용 알림</div>
                                <div className={styles.notiDesc}>배출 당일 오전 9시 알림</div>
                            </div>
                            <Toggle active={notificationSettings.recycle} onClick={() => handleToggleNotification('recycle')} />
                        </div>
                        <div className={styles.notificationItem}>
                            <div className={styles.notiInfo}>
                                <div className={styles.notiLabel}>음식물 알림</div>
                                <div className={styles.notiDesc}>배출 당일 오전 9시 알림</div>
                            </div>
                            <Toggle active={notificationSettings.food} onClick={() => handleToggleNotification('food')} />
                        </div>
                    </div>
                    {!isSubscribed && (
                        <div className={styles.premiumBadgeCal}>PREMIUM</div>
                    )}
                </div>
            </section>
        </div>
    );
}
