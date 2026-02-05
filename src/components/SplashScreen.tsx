'use client';

import { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
    const [show, setShow] = useState(true);

    useEffect(() => {
        /* 
           Timeline:
           0.0s - 1.2s: Drop falls from top
           1.2s: Impact -> Ripple expands
           1.2s - 2.0s: Robot (Bubble Shape) pops up
           1.8s: "어서와!" Text appear
           3.5s: Fade out start
           4.3s: Finish
        */
        const timer = setTimeout(() => {
            setShow(false);
            setTimeout(onFinish, 800);
        }, 4000);

        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <div className={`${styles.splashContainer} ${!show ? styles.hidden : ''}`}>
            <div className={styles.centerZone}>
                <div className={styles.waterDrop}></div>
                <div className={styles.ripple}></div>

                <div className={styles.robot}>
                    <img
                        src="/images/eco_mascot_welcome.png"
                        alt="Eco Helper"
                        className={styles.mascotImage}
                    />
                </div>
            </div>

            <h1 className={styles.greetingText}>어서와!</h1>
        </div>
    );
}
