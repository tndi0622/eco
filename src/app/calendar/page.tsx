'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';



export default function Calendar() {
    const [viewDate, setViewDate] = useState(new Date());
    const [today, setToday] = useState<Date | null>(null);
    const [holidays, setHolidays] = useState<any[]>([]);

    useEffect(() => {
        setToday(new Date());
    }, []);

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
                console.error("Failed to fetch holidays", err);
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

    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    // Array representing the grid cells
    const calendarDays = [];

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        calendarDays.push(null);
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push(i);
    }

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

    // Also get holiday name for tooltip or display if needed, but user just asked for color.

    // Helper to determine day class
    const getDayClass = (date: number | null, index: number) => {
        if (!date) return styles.empty;

        const colIndex = index % 7;
        const isSunday = colIndex === 0;
        const isSaturday = colIndex === 6;
        const isPublicHoliday = isHoliday(date);

        let className = styles.day;

        if (isToday(date)) {
            className += ` ${styles.active}`;
        }

        // Priority: Holiday (Red) -> Sunday (Red) -> Saturday (Blue)
        if (isPublicHoliday) {
            className += ` ${styles.holidayText}`; // We need to define this or reuse sunday style
        } else if (isSunday) {
            className += ` ${styles.sunday}`;
        } else if (isSaturday) {
            className += ` ${styles.saturday}`;
        }

        return className;
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return (
        <div className={styles.container}>
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
                        <div
                            key={index}
                            className={getDayClass(date, index)}
                        >
                            {date}
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.infoSection}>
                <div className={`${styles.alertBox} ${styles.recycling}`}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 17L4.66 12L7 7H17L19.34 12L17 17H7ZM7 5L3 12L7 19H17L21 12L17 5H7ZM12 4C13.1 4 14 4.9 14 6H10C10 4.9 10.9 4 12 4ZM16.3 7H18V5H16.3C15.7 3.2 14 2 12 2C10 2 8.3 3.2 7.7 5H6V7H7.7C8 8 9 9 10 9H14C15 9 16 8 16.3 7Z" fill="white" />
                    </svg>
                    <span>오늘은 재활용 버리는 날입니다.</span>
                </div>

                <div className={`${styles.alertBox} ${styles.holiday}`}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="white" />
                    </svg>
                    <span>설연휴 동안은 수거하지않습니다.</span>
                </div>
            </div>
        </div>
    );
}
