'use client';

import { useRouter } from 'next/navigation';
import styles from './ChatbotButton.module.css';

export default function ChatbotButton() {
    const router = useRouter();

    const handleClick = () => {
        router.push('/chat');
    };

    return (
        <button className={styles.container} onClick={handleClick} aria-label="Open Chatbot">
            <span className={styles.tooltip}>무엇이든 물어보세요!</span>
            <img
                src="/images/eco_mascot_welcome.png"
                alt="Chatbot"
                className={styles.icon}
                onError={(e) => {
                    // 유저가 이미지를 아직 로드하지 않은 경우의 폴백 처리
                    e.currentTarget.style.display = 'none';
                }}
            />
        </button>
    );
}
