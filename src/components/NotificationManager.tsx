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

    // 위치 변경 시 규칙 로드
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
                console.error("알림용 폐기물 규칙을 로드하지 못했습니다", e);
            }
        };

        fetchRules();
    }, [location]);

    // 매 분마다 시간 확인
    useEffect(() => {
        const checkTime = () => {
            const now = new Date();
            const currentMinute = `${now.getHours()}:${now.getMinutes()}`;

            // 같은 분에 여러 번 확인하는 것을 방지
            if (lastCheckMinute.current === currentMinute) return;
            lastCheckMinute.current = currentMinute;

            // 설정 로드
            const saved = localStorage.getItem('notificationSettings');
            if (!saved) return;
            const settings: NotificationSettings = JSON.parse(saved);

            if (!rules || rules.length === 0) return;
            const rule = rules[0];

            // 시간 파싱 헬퍼: "18:00~24:00" -> 18, 0
            const parseTime = (timeStr?: string) => {
                if (!timeStr) return { h: 19, m: 0 }; // 기본값
                const start = timeStr.split('~')[0].trim();
                const [h, m] = start.split(':').map(Number);
                return { h: h, m: m || 0 };
            };

            // 1. 일반 쓰레기
            if (settings.general && rule.gnrlWsteDschrgDay) {
                const { h, m } = parseTime(rule.gnrlWsteDschrgTime);
                checkAndNotify('일반쓰레기', rule.gnrlWsteDschrgDay, h, m, now);
            }

            // 2. 재활용
            if (settings.recycle && rule.recycleDschrgDay) {
                const { h, m } = parseTime(rule.recycleDschrgTime);
                checkAndNotify('재활용', rule.recycleDschrgDay, h, m, now);
            }

            // 3. 음식물
            if (settings.food && rule.foodWsteDschrgDay) {
                const { h, m } = parseTime(rule.foodWsteDschrgTime);
                checkAndNotify('음식물쓰레기', rule.foodWsteDschrgDay, h, m, now);
            }
        };

        const checkAndNotify = (type: string, daysStr: string, targetH: number, targetM: number, now: Date) => {
            // 시간 일치 확인
            if (now.getHours() !== targetH || now.getMinutes() !== targetM) return;

            // 요일 일치 확인
            const todayDay = now.getDay(); // 0(Sun) - 6(Sat)
            const dayMap = ['일', '월', '화', '수', '목', '금', '토'];

            // 로직:
            // "매일"인 경우 -> 오늘 알림
            // 특정 요일인 경우 -> 내일인 경우 오늘 알림 (설정 로직 "전날" 기준)

            if (daysStr.includes('매일')) {
                sendNotification(type, '오늘 배출 시간입니다!');
            } else {
                // 배출일이 내일인 경우, 오늘 알림
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
                    icon: '/favicon.ico' // 파비콘이 있다고 가정
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

        const timer = setInterval(checkTime, 1000 * 30); // 30초마다 확인
        return () => clearInterval(timer);
    }, [rules]);

    return null; // 로직만 수행
}
