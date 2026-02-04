'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function Settings() {
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);

    const toggleNotifications = () => {
        setNotificationsEnabled(!notificationsEnabled);
    };

    return (
        <div className={styles.container}>
            <section className={styles.section}>
                <div className={styles.header}>알림 설정</div>
                <div className={styles.row}>
                    <span className={styles.label}>미수거일 안내</span>
                    <button
                        className={`${styles.toggle} ${notificationsEnabled ? styles.active : ''}`}
                        onClick={toggleNotifications}
                        aria-label="Toggle notifications"
                    >
                        <div className={styles.toggleHandle} />
                    </button>
                </div>
            </section>

            {/* Developer/Design System Check - Optional based on wireframe having colors shown */}
            <section className={styles.section}>
                <div className={styles.header}>시스템 정보</div>
                <div className={styles.colors}>
                    <div className={styles.colorRow}>
                        <div className={styles.colorBox} style={{ backgroundColor: '#2D9CDB' }} />
                        <span className={styles.colorCode}>#2D9CDB (Blue)</span>
                    </div>
                    <div className={styles.colorRow}>
                        <div className={styles.colorBox} style={{ backgroundColor: '#27AE60' }} />
                        <span className={styles.colorCode}>#27AE60 (Green)</span>
                    </div>
                    <div className={styles.colorRow}>
                        <div className={styles.colorBox} style={{ backgroundColor: '#F2F2F2' }} />
                        <span className={styles.colorCode}>#F2F2F2 (Gray)</span>
                    </div>
                    <div className={styles.colorRow}>
                        <div className={styles.colorBox} style={{ backgroundColor: '#EB5757' }} />
                        <span className={styles.colorCode}>#EB5757 (Red)</span>
                    </div>
                </div>
            </section>
        </div>
    );
}
