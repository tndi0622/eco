'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { useLocation } from '@/context/LocationContext';
import { useUser } from '@/context/UserContext';

// 간단한 토글 컴포넌트
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

    // 알림 상태
    const [notificationSettings, setNotificationSettings] = useState({
        general: false,
        recycle: false,
        food: false
    });

    useEffect(() => {
        const saved = localStorage.getItem('notificationSettings');
        if (saved) setNotificationSettings(JSON.parse(saved));
        setToday(new Date());
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

    // 기본 스케줄 (폴백)
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
    const [dischargeTime, setDischargeTime] = useState('18:00 ~ 24:00'); // 기본 시간
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [selectedSchedule, setSelectedSchedule] = useState('');

    // 파싱 헬퍼
    const parseRulesToSchedule = (rules: any[]) => {
        const dailySets = Array.from({ length: 7 }, () => new Set<string>());

        rules.forEach(rule => {
            const addItems = (dayStr: string, itemType: string) => {
                if (!dayStr) return;
                Object.keys(dayMap).forEach(key => {
                    if (dayStr.includes(key)) {
                        const idx = dayMap[key];
                        dailySets[idx].add(itemType);
                    }
                });
                if (dayStr.includes('매일')) {
                    for (let i = 0; i < 7; i++) dailySets[i].add(itemType);
                }
            };

            addItems(rule.gnrlWsteDschrgDay, '일반쓰레기');
            addItems(rule.foodWsteDschrgDay, '음식물');
            addItems(rule.recycleDschrgDay, '재활용');
        });

        const newSchedule: { [key: number]: string } = {};
        for (let i = 0; i < 7; i++) {
            newSchedule[i] = dailySets[i].size > 0 ? Array.from(dailySets[i]).join(', ') : '배출 없음 (미수거일)';
        }
        return newSchedule;
    };

    useEffect(() => {
        const loadSaved = () => {
            const saved = localStorage.getItem('ecoDischargeSchedule');
            const savedTime = localStorage.getItem('ecoDischargeTime');
            if (saved) {
                try { setDischargeSchedule(JSON.parse(saved)); } catch (e) { }
            }
            if (savedTime) setDischargeTime(savedTime);
        };

        if (location && location !== '위치 설정이 필요합니다') {
            const fetchRules = async () => {
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

                            const timeRule = data.rules.find((r: any) => r.gnrlWsteDschrgTime || r.recycleDschrgTime || r.foodWsteDschrgTime);
                            const timeInfo = timeRule ? (timeRule.gnrlWsteDschrgTime || timeRule.recycleDschrgTime || timeRule.foodWsteDschrgTime) : '';
                            const formattedTime = timeInfo ? timeInfo.replace('~', ' ~ ') : '18:00 ~ 24:00';
                            setDischargeTime(formattedTime);

                            localStorage.setItem('ecoDischargeSchedule', JSON.stringify(newSched));
                            localStorage.setItem('ecoDischargeTime', formattedTime);

                            // 선택된 날짜의 스케줄도 업데이트
                            if (selectedDate) {
                                setSelectedSchedule(newSched[selectedDate.getDay()] || '배출 없음');
                            }
                        } else {
                            loadSaved();
                        }
                    } catch (e) {
                        loadSaved();
                    }
                } else {
                    loadSaved();
                }
            };
            fetchRules();
        } else {
            loadSaved();
        }
    }, [location]);

    // 초기 선택 스케줄 설정
    useEffect(() => {
        if (selectedDate && dischargeSchedule[selectedDate.getDay()]) {
            setSelectedSchedule(dischargeSchedule[selectedDate.getDay()]);
        }
    }, [dischargeSchedule]);

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
            } catch (err) { }
        };
        fetchHolidays();
    }, [viewDate]);

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

    const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const curYear = viewDate.getFullYear();
    const curMonth = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(curYear, curMonth);
    const firstDay = getFirstDayOfMonth(curYear, curMonth);

    const calendarDays = [];
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

    const isToday = (day: number) => {
        if (!today || !day) return false;
        return day === today.getDate() && curMonth === today.getMonth() && curYear === today.getFullYear();
    };

    const isSelected = (day: number) => {
        if (!selectedDate || !day) return false;
        return day === selectedDate.getDate() && curMonth === selectedDate.getMonth() && curYear === selectedDate.getFullYear();
    };

    const isDayHoliday = (day: number) => {
        if (!day) return false;
        const dateStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return holidays.some(h => h.date === dateStr);
    };

    const handleDateClick = (day: number) => {
        if (!day) return;
        const newDate = new Date(curYear, curMonth, day);
        setSelectedDate(newDate);
        setSelectedSchedule(dischargeSchedule[newDate.getDay()] || '배출 없음');
    };

    const getDayContent = (day: number) => {
        if (!day) return null;
        const dayOfWeek = new Date(curYear, curMonth, day).getDay();
        const info = dischargeSchedule[dayOfWeek] || '';

        let dotColor = 'transparent';
        if (info.includes('일반')) dotColor = '#27AE60';
        else if (info.includes('재활용')) dotColor = '#F2994A';

        return (
            <div className={styles.dayContent}>
                <span className={styles.dayNumber}>{day}</span>
                {dotColor !== 'transparent' && <div className={styles.dot} style={{ backgroundColor: dotColor }}></div>}
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.calendarCard}>
                <div className={styles.header}>
                    <button onClick={handlePrevMonth} className={styles.navBtn}>&lt;</button>
                    <span className={styles.monthTitle}>{curYear}년 {curMonth + 1}월</span>
                    <button onClick={handleNextMonth} className={styles.navBtn}>&gt;</button>
                </div>
                <div className={styles.grid}>
                    {dayNames.map((day, index) => (
                        <div key={day} className={`${styles.dayName} ${index === 0 ? styles.sunday : ''} ${index === 6 ? styles.saturday : ''}`}>
                            {day}
                        </div>
                    ))}
                    {calendarDays.map((date, index) => (
                        <div
                            key={index}
                            className={`${styles.day} ${isToday(date as number) ? styles.today : ''} ${isSelected(date as number) ? styles.selected : ''} ${isDayHoliday(date as number) ? styles.sunday : ''}`}
                            onClick={() => handleDateClick(date as number)}
                        >
                            {getDayContent(date as number)}
                        </div>
                    ))}
                </div>
            </div>

            <section className={styles.actionCard}>
                <div className={styles.actionHeader}>
                    {selectedDate && (
                        <div className={styles.selectedDateDisplay}>
                            {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({['일', '월', '화', '수', '목', '금', '토'][selectedDate.getDay()]})
                            {isToday(selectedDate.getDate()) && curMonth === new Date().getMonth() && <span className={styles.todayBadge}>TODAY</span>}
                        </div>
                    )}
                </div>

                <div className={styles.scheduleInfo}>
                    <div className={styles.infoLabel}>배출 가능 품목</div>
                    <div className={styles.infoValue}>{selectedSchedule || '정보 없음'}</div>
                </div>

                <div className={styles.metaInfo}>
                    <span>⏰ {dischargeTime}</span>
                    <span>📍 {location.split(' ')[1] || '위치 미설정'} 기준</span>
                </div>

                <div className={styles.buttonGroup}>
                    {selectedSchedule.includes('대형') && <button className={styles.callBtn}>📞 대형폐기물 신청</button>}
                </div>

                <div className={styles.notiSection}>
                    <div className={styles.notiHeader}>맞춤 알림 설정</div>
                    <div className={styles.notificationList}>
                        {[
                            { key: 'general', label: '일반쓰레기 알림', desc: '배출 당일 오전 9시 알림' },
                            { key: 'recycle', label: '재활용 알림', desc: '배출 당일 오전 9시 알림' },
                            { key: 'food', label: '음식물 알림', desc: '배출 당일 오전 9시 알림' }
                        ].map(item => (
                            <div key={item.key} className={styles.notificationItem}>
                                <div className={styles.notiInfo}>
                                    <div className={item.key === 'general' ? styles.notiLabel : styles.notiLabel}>{item.label}</div>
                                    <div className={styles.notiDesc}>{item.desc}</div>
                                </div>
                                <Toggle active={notificationSettings[item.key as keyof typeof notificationSettings]} onClick={() => handleToggleNotification(item.key as keyof typeof notificationSettings)} />
                            </div>
                        ))}
                    </div>
                    {!isSubscribed && <div className={styles.premiumBadgeCal}>PREMIUM</div>}
                </div>
            </section>
        </div>
    );
}
