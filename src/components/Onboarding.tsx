'use client';

import { useState } from 'react';
import styles from './Onboarding.module.css';
import { useLocation } from '@/context/LocationContext';

interface OnboardingProps {
    onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
    const [step, setStep] = useState(0);
    const { detectLocation, addFavorite, isLoading: isLocationLoading } = useLocation();

    const steps = [
        {
            title: "이사 온 첫날,\n쓰레기 배출 막막하시죠?",
            desc: "지역마다 다른 배출 요일과 방법,\n에코도우미가 싹- 정리해드릴게요.",
            image: "🗑️",
            btnText: "다음으로"
        },
        {
            title: "어디 사시는지\n알려주세요!",
            desc: "정확한 수거 요일과 담당 부서를\n안내해드리기 위해 필요해요.",
            image: "📍",
            btnText: "현재 위치로 시작하기"
        },
        {
            title: "이제 배출일 놓칠\n걱정 없어요!",
            desc: "저녁 배출 시간에 맞춰\n미리 알림을 보내드릴게요.",
            image: "🔔",
            btnText: "에코도우미 시작하기"
        }
    ];

    const handleNext = async () => {
        if (step === 1) {
            // 위치 설정 단계
            const { address, coordinates, error } = await detectLocation();

            if (!error && address && !address.includes('실패') && !address.includes('미지원')) {
                // 성공 - 자동으로 '우리 집'으로 저장
                addFavorite("우리 집", address, coordinates || undefined);
                setStep(step + 1);
            } else {
                // 이미 로딩 중인 경우(중복 클릭 등)에는 무시하거나 기다림
                if (error === "이미 위치를 확인 중입니다.") return;

                // 실패 - 사용자에게 알림 (여기서는 다음 단계로 넘기지 않고 머무르게 할 수도 있지만, 
                // 기존 기획대로 다음으로 넘기되 메세지만 보여줌)
                alert(error || "위치 확인에 실패했습니다. 나중에 설정에서 직접 등록해주세요.");
                setStep(step + 1);
            }
        } else if (step === 2) {
            // 마지막 단계
            const defaultSettings = { general: false, recycle: false, food: false };
            localStorage.setItem('notificationSettings', JSON.stringify(defaultSettings));
            onComplete();
        } else {
            setStep(step + 1);
        }
    };

    const handleBack = () => {
        if (step > 0) setStep(step - 1);
    };

    return (
        <div className={styles.overlay}>
            {step > 0 && (
                <button className={styles.backBtn} onClick={handleBack} aria-label="이전 단계">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
            )}
            <button className={styles.skipBtn} onClick={onComplete}>건너뛰기</button>

            <div className={styles.slideContainer}>
                <div className={styles.imageArea} style={{ fontSize: '5rem' }}>
                    {steps[step].image}
                </div>

                <h1 className={styles.title} style={{ whiteSpace: 'pre-line' }}>
                    {steps[step].title}
                </h1>

                <p className={styles.description} style={{ whiteSpace: 'pre-line' }}>
                    {steps[step].desc}
                </p>

                <div className={styles.indicators}>
                    {steps.map((_, idx) => (
                        <div
                            key={idx}
                            className={`${styles.dot} ${idx === step ? styles.active : ''}`}
                        />
                    ))}
                </div>
            </div>

            <div className={styles.controls}>
                <button
                    className={`${styles.actionBtn} ${styles.primaryBtn}`}
                    onClick={handleNext}
                    disabled={isLocationLoading}
                >
                    {isLocationLoading ? '위치 확인 중...' : steps[step].btnText}
                </button>
            </div>
        </div>
    );
}
