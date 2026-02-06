'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function Settings() {


    return (
        <div className={styles.container}>


            <section className={styles.section}>
                <div className={styles.header}>담당 부서 직통 연결</div>
                <div className={styles.contactList}>
                    <div className={styles.contactItem}>
                        <div>
                            <span className={styles.deptName}>자원순환과</span>
                            <span className={styles.deptRole}>재활용, 대형폐기물 총괄</span>
                        </div>
                        <a href="tel:02-123-4567" className={styles.callBtn}>
                            전화하기
                        </a>
                    </div>
                    <div className={styles.contactItem}>
                        <div>
                            <span className={styles.deptName}>청소행정과</span>
                            <span className={styles.deptRole}>가로 청소, 무단투기 단속</span>
                        </div>
                        <a href="tel:02-123-4568" className={styles.callBtn}>
                            전화하기
                        </a>
                    </div>
                    <div className={styles.contactItem}>
                        <div>
                            <span className={styles.deptName}>민원 콜센터</span>
                            <span className={styles.deptRole}>일반 배출 문의</span>
                        </div>
                        <a href="tel:120" className={styles.callBtn}>
                            전화하기
                        </a>
                    </div>
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
