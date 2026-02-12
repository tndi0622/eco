'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@/context/LocationContext';

interface NotificationSettings {
    general: boolean;
    recycle: boolean;
    food: boolean;
}

export default function NotificationManager() {
    const { location } = useLocation();
    const [rules, setRules] = useState<any[]>([]);
    const lastCheckMinute = useRef<string>('');

    // Load Rules when location changes
    useEffect(() => {
        if (!location || location.includes('설정') || location.includes('실패')) return;

        const fetchRules = async () => {
            const parts = location.split(' ');
            const sido = parts[0];
            const sigungu = parts[1];
            const dong = parts[2] || '';

            try {
                const res = await fetch(`/api/waste-rules?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}&dong=${encodeURIComponent(dong)}`);
                const data = await res.json();
                if (data.rules) {
                    setRules(data.rules);
                }
            } catch (e) {
                console.error("Failed to load waste rules for notifications", e);
            }
        };

        fetchRules();
    }, [location]);

    // Check Time Every Minute
    useEffect(() => {
        const checkTime = () => {
            const now = new Date();
            const currentMinute = `${now.getHours()}:${now.getMinutes()}`;

            // Prevent multiple checks in same minute
            if (lastCheckMinute.current === currentMinute) return;
            lastCheckMinute.current = currentMinute;

            // Load Settings
            const saved = localStorage.getItem('notificationSettings');
            if (!saved) return;
            const settings: NotificationSettings = JSON.parse(saved);

            if (!rules || rules.length === 0) return;
            const rule = rules[0];

            // Helper to parsing time "18:00~24:00" -> 18, 0
            const parseTime = (timeStr?: string) => {
                if (!timeStr) return { h: 19, m: 0 }; // Default
                const start = timeStr.split('~')[0].trim();
                const [h, m] = start.split(':').map(Number);
                return { h: h, m: m || 0 };
            };

            // 1. General Waste
            if (settings.general && rule.gnrlWsteDschrgDay) {
                const { h, m } = parseTime(rule.gnrlWsteDschrgTime);
                checkAndNotify('일반쓰레기', rule.gnrlWsteDschrgDay, h, m, now);
            }

            // 2. Recycle
            if (settings.recycle && rule.recycleDschrgDay) {
                const { h, m } = parseTime(rule.recycleDschrgTime);
                checkAndNotify('재활용', rule.recycleDschrgDay, h, m, now);
            }

            // 3. Food
            if (settings.food && rule.foodWsteDschrgDay) {
                const { h, m } = parseTime(rule.foodWsteDschrgTime);
                checkAndNotify('음식물쓰레기', rule.foodWsteDschrgDay, h, m, now);
            }
        };

        const checkAndNotify = (type: string, daysStr: string, targetH: number, targetM: number, now: Date) => {
            // Check Time Match
            if (now.getHours() !== targetH || now.getMinutes() !== targetM) return;

            // Check Day Match
            const todayDay = now.getDay(); // 0(Sun) - 6(Sat)
            const dayMap = ['일', '월', '화', '수', '목', '금', '토'];

            // Logic:
            // If "Everyday" -> Notify today
            // If specific days -> Notify "Day Before" (as per settings logic "전날")

            if (daysStr.includes('매일')) {
                sendNotification(type, '오늘 배출 시간입니다!');
            } else {
                // If discharge day is Tomorrow, notify today
                const tomorrowDay = (todayDay + 1) % 7;
                const tomorrowChar = dayMap[tomorrowDay];

                if (daysStr.includes(tomorrowChar)) {
                    sendNotification(type, `내일은 ${type} 배출일입니다! 준비해주세요.`);
                }
            }
        };

        const sendNotification = (title: string, body: string) => {
            if (Notification.permission === 'granted') {
                new Notification(`[에코도우미] ${title}`, {
                    body: body,
                    icon: '/favicon.ico' // Assuming favicon exists
                });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification(`[에코도우미] ${title}`, {
                            body: body,
                            icon: '/favicon.ico'
                        });
                    }
                });
            }
        };

        const timer = setInterval(checkTime, 1000 * 30); // Check every 30s
        return () => clearInterval(timer);
    }, [rules]);

    return null; // Logic only
}
