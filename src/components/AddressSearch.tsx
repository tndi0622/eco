'use client';

import DaumPostcode from 'react-daum-postcode';
import styles from './AddressSearch.module.css';

interface AddressSearchProps {
    onComplete: (address: string) => void;
    onClose: () => void;
}

export default function AddressSearch({ onComplete, onClose }: AddressSearchProps) {
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

        // Custom format: Sido + Sigungu + Bname
        const customAddr = `${data.sido} ${data.sigungu} ${data.bname}`.trim();

        // Return the formatted address
        onComplete(customAddr);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <span className={styles.title}>주소 검색</span>
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
