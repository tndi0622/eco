'use client';

import { useState, useEffect } from 'react';
import DaumPostcode from 'react-daum-postcode';
import styles from './AddressSearch.module.css';

interface AddressSearchProps {
    onComplete: (address: string) => void;
    onClose: () => void;
}

export default function AddressSearch({ onComplete, onClose }: AddressSearchProps) {
    const [savedPlaces, setSavedPlaces] = useState<{ home: string, work: string }>({ home: '', work: '' });
    const [mode, setMode] = useState<'normal' | 'setHome' | 'setWork'>('normal');

    useEffect(() => {
        const load = () => {
            const home = localStorage.getItem('place_home') || '';
            const work = localStorage.getItem('place_work') || '';
            setSavedPlaces({ home, work });
        };
        load();
    }, []);

    const savePlace = (type: 'home' | 'work', address: string) => {
        localStorage.setItem(`place_${type}`, address);
        setSavedPlaces(prev => ({ ...prev, [type]: address }));
    };

    const handleComplete = (data: any) => {
        let fullAddress = data.address;
        let extraAddress = '';

        if (data.addressType === 'R') {
            if (data.bname !== '') {
                extraAddress += data.bname;
            }
            if (data.buildingName !== '') {
                extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
            }
            fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
        }

        // Simpler format for "Eco App": Sido + Sigungu + Bname
        // Use custom format generally, but for saving Home/Work, 
        // passing the result to onComplete uses the same format.
        const customAddr = `${data.sido} ${data.sigungu} ${data.bname}`.trim();

        if (mode === 'setHome') {
            savePlace('home', customAddr);
            setMode('normal');
            onComplete(customAddr);
        } else if (mode === 'setWork') {
            savePlace('work', customAddr);
            setMode('normal');
            onComplete(customAddr);
        } else {
            onComplete(customAddr);
        }
    };

    const handleQuickSelect = (type: 'home' | 'work') => {
        const addr = savedPlaces[type];
        if (addr) {
            onComplete(addr);
        } else {
            // Enter Set Mode
            setMode(type === 'home' ? 'setHome' : 'setWork');
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <span className={styles.title}>
                        {mode === 'normal' ? '주소 검색' : (mode === 'setHome' ? '🏠 우리집 설정' : '🏢 회사 설정')}
                    </span>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                {/* My Places Toolbar */}
                <div className={styles.placeToolbar}>
                    <button
                        className={`${styles.placeChip} ${savedPlaces.home ? styles.activeChip : ''} ${mode === 'setHome' ? styles.settingChip : ''}`}
                        onClick={() => handleQuickSelect('home')}
                    >
                        {savedPlaces.home ? `🏠 ${savedPlaces.home}` : '+ 🏠 집 등록'}
                    </button>
                    <button
                        className={`${styles.placeChip} ${savedPlaces.work ? styles.activeChip : ''} ${mode === 'setWork' ? styles.settingChip : ''}`}
                        onClick={() => handleQuickSelect('work')}
                    >
                        {savedPlaces.work ? `🏢 ${savedPlaces.work}` : '+ 🏢 회사 등록'}
                    </button>
                </div>

                {mode !== 'normal' && (
                    <div className={styles.helperText}>
                        검색하여 등록할 주소를 선택해주세요.
                        <button className={styles.cancelModeBtn} onClick={() => setMode('normal')}>취소</button>
                    </div>
                )}

                <div className={styles.content}>
                    <DaumPostcode
                        onComplete={handleComplete}
                        style={{ height: '100%' }}
                    />
                </div>
            </div>
        </div>
    );
}
