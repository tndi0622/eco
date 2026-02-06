'use client';

import { useState } from 'react';
import styles from './EcoDashboard.module.css';

export default function EcoDashboard() {
    // Shared state (mock for now, ideally in context)
    const [ecoScore, setEcoScore] = useState(300);
    const [level, setLevel] = useState(1);
    const [showHistory, setShowHistory] = useState(false);
    const treesSaved = 0.5;

    const historyItems = [
        { date: '2026.02.06', desc: '앱 설치 환영 보너스', point: 300 },
    ];

    const toggleHistory = () => setShowHistory(!showHistory);

    return (
        <>
            <section className={styles.ecoDashboard} onClick={toggleHistory} style={{ cursor: 'pointer' }}>
                <div className={styles.dashboardHeader}>
                    <div>
                        <span className={styles.userName}>환경 지킴이님</span>의 에코 기여도
                    </div>
                    <div className={styles.levelBadge}>LV. {level} 새싹</div>
                </div>
                <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                        <div className={styles.statValue}>{ecoScore}</div>
                        <div className={styles.statLabel}>내 에코 포인트</div>
                    </div>
                    <div className={styles.statDivider}></div>
                    <div className={styles.statItem}>
                        <div className={styles.statValue}>🌲 {treesSaved}</div>
                        <div className={styles.statLabel}>살린 소나무</div>
                    </div>
                </div>
                <div className={styles.progressBarContainer}>
                    <div className={styles.progressBarFill} style={{ width: '20%' }}></div>
                </div>
                <div className={styles.progressText}>터치해서 적립 내역 확인하기 👉</div>
            </section>

            {/* History Modal */}
            {showHistory && (
                <div className={styles.historyModalOverlay} onClick={toggleHistory}>
                    <div className={styles.historyCard} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.historyHeader}>
                            <h3>🌱 포인트 적립 내역</h3>
                            <button onClick={toggleHistory} className={styles.closeBtn}>X</button>
                        </div>
                        <ul className={styles.historyList}>
                            {historyItems.map((item, idx) => (
                                <li key={idx} className={styles.historyItem}>
                                    <div className={styles.historyDate}>{item.date}</div>
                                    <div className={styles.historyDesc}>{item.desc}</div>
                                    <div className={styles.historyPoint}>+{item.point}</div>
                                </li>
                            ))}
                        </ul>
                        <div className={styles.historyFooter}>
                            <p>열심히 분리배출하고<br />레벨업해보세요! ✨</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
