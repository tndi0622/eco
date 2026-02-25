'use client';

import DaumPostcode from 'react-daum-postcode';
import styles from './AddressSearch.module.css';

interface AddressSearchProps {
    onComplete: (address: string) => void;
    onClose: () => void;
    onDetectLocation?: () => void;
}

export default function AddressSearch({ onComplete, onClose, onDetectLocation }: AddressSearchProps) {
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

        // 커스텀 형식: 시도 + 시군구 + 법정동명
        const customAddr = `${data.sido} ${data.sigungu} ${data.bname}`.trim();

        // 포맷된 주소 반환
        onComplete(customAddr);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={styles.title}>주소 검색</span>
                        {onDetectLocation && (
                            <button
                                onClick={onDetectLocation}
                                style={{
                                    border: '1px solid #27AE60',
                                    borderRadius: '12px',
                                    background: 'white',
                                    color: '#27AE60',
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }}
                            >
                                📍 현재 위치로 찾기
                            </button>
                        )}
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

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
