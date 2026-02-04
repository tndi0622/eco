'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';

const HomeIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z" />
    </svg>
);

const ChatIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" />
    </svg>
);

const CalendarIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 4H18V2H16V4H8V2H6V4H5C3.89 4 3.01 4.9 3.01 6L3 20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V10H19V20ZM19 8H5V6H19V8ZM9 14H7V12H9V14ZM13 14H11V12H13V14ZM17 14H15V12H17V14ZM9 18H7V16H9V18ZM13 18H11V16H13V18ZM17 18H15V16H17V18Z" />
    </svg>
);

const SettingsIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.14 12.94C19.16 12.78 19.17 12.61 19.17 12.45C19.17 12.29 19.16 12.12 19.14 11.96L21.5 10.12C21.71 9.96 21.77 9.66 21.63 9.43L19.63 5.96C19.5 5.73 19.22 5.64 18.99 5.72L16.21 6.84C15.63 6.39 15.01 6.03 14.33 5.75L13.91 2.79C13.84 2.53 13.62 2.34 13.35 2.34H9.35C9.09 2.34 8.86 2.53 8.8 2.79L8.38 5.75C7.7 6.03 7.08 6.39 6.5 6.84L3.72 5.73C3.49 5.64 3.22 5.73 3.08 5.97L1.08 9.43C0.95 9.67 1.01 9.97 1.22 10.13L3.58 11.97C3.56 12.13 3.55 12.29 3.55 12.45C3.55 12.61 3.56 12.78 3.58 12.94L1.22 14.78C1.01 14.94 0.95 15.24 1.08 15.47L3.08 18.94C3.21 19.17 3.49 19.27 3.72 19.18L6.5 18.07C7.08 18.52 7.7 18.88 8.38 19.16L8.8 22.12C8.86 22.38 9.09 22.57 9.35 22.57H13.35C13.61 22.57 13.84 22.38 13.9 22.12L14.33 19.16C15.01 18.88 15.63 18.52 16.21 18.07L18.99 19.18C19.22 19.27 19.5 19.17 19.63 18.93L21.63 15.47C21.76 15.24 21.71 14.94 21.5 14.78L19.14 12.94ZM11.35 15.93C9.42 15.93 7.85 14.37 7.85 12.44C7.85 10.51 9.42 8.94 11.35 8.94C13.28 8.94 14.85 10.51 14.85 12.44C14.85 14.37 13.28 15.93 11.35 15.93Z" />
    </svg>
);

export default function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        { name: '홈', path: '/', icon: <HomeIcon /> },
        { name: '채팅', path: '/chat', icon: <ChatIcon /> },
        { name: '캘린더', path: '/calendar', icon: <CalendarIcon /> },
        { name: '설정', path: '/settings', icon: <SettingsIcon /> },
    ];

    return (
        <nav className={styles.nav}>
            {navItems.map((item) => (
                <Link
                    key={item.path}
                    href={item.path}
                    className={`${styles.item} ${pathname === item.path ? styles.active : ''}`}
                >
                    {item.icon}
                    <span>{item.name}</span>
                </Link>
            ))}
        </nav>
    );
}
