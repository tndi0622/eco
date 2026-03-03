'use client';

import { useEffect, useRef } from 'react';

interface NotificationSettings {
    general: boolean;
    generalTime?: string;
    generalDays?: number[];
    recycle: boolean;
    recycleTime?: string;
    recycleDays?: number[];
    food: boolean;
    foodTime?: string;
    foodDays?: number[];
}

export default function NotificationManager() {
    const lastCheckMinute = useRef<string>('');

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

            let settings: NotificationSettings;
            try {
                settings = JSON.parse(saved);
                if (!settings || typeof settings !== 'object') return;
            } catch (e) {
                console.error("Failed to parse settings", e);
                return;
            }

            // 시간 파싱 헬퍼: "18:00" -> 18, 0
            const parseTime = (timeStr?: string) => {
                if (!timeStr) return { h: 19, m: 0 }; // 기본값
                const [h, m] = timeStr.split(':').map(Number);
                return { h: h, m: m || 0 };
            };

            // 1. 일반 쓰레기
            if (settings.general && settings.generalDays?.includes(now.getDay())) {
                const { h, m } = parseTime(settings.generalTime);
                if (now.getHours() === h && now.getMinutes() === m) {
                    sendNotification('일반 쓰레기', '지금은 일반 쓰레기 배출 시간입니다!');
                }
            }

            // 2. 재활용
            if (settings.recycle && settings.recycleDays?.includes(now.getDay())) {
                const { h, m } = parseTime(settings.recycleTime);
                if (now.getHours() === h && now.getMinutes() === m) {
                    sendNotification('재활용 쓰레기', '지금은 재활용 쓰레기 배출 시간입니다!');
                }
            }

            // 3. 음식물
            if (settings.food && settings.foodDays?.includes(now.getDay())) {
                const { h, m } = parseTime(settings.foodTime);
                if (now.getHours() === h && now.getMinutes() === m) {
                    sendNotification('음식물 쓰레기', '지금은 음식물 쓰레기 배출 시간입니다!');
                }
            }
        };

        const sendNotification = (title: string, body: string) => {
            // 1. Flutter 네이티브 브릿지 확인
            if (window.flutter_inappwebview) {
                window.flutter_inappwebview.callHandler('showNotification', { title, body });
                return;
            }

            // 2. 웹 브라우저 알림 (기존 로직 - 폴백용)
            if (typeof Notification !== 'undefined') {
                if (Notification.permission === 'granted') {
                    new Notification(`[에코도우미] ${title}`, {
                        body: body,
                        icon: '/favicon.ico'
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
            } else {
                console.log(`알림 (브라우저 미지원): ${title} - ${body}`);
            }
        };

        const timer = setInterval(checkTime, 1000 * 30); // 30초마다 확인
        return () => clearInterval(timer);
    }, []);

    return null; // 로직만 수행
}
