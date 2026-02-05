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
                src="/images/eco_mascot_icon.png"
                alt="Chatbot"
                className={styles.icon}
                onError={(e) => {
                    // Fallback if image not yet loaded by user
                    e.currentTarget.style.display = 'none';
                }}
            />
        </button>
    );
}
