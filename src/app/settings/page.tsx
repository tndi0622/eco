'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { useLocation } from '@/context/LocationContext';
import AddressSearch from '@/components/AddressSearch';

export default function Settings() {
    const { location, favorites, addFavorite, removeFavorite, promoteFavorite } = useLocation();
    const [showAddressSearch, setShowAddressSearch] = useState(false);
    const [showNameModal, setShowNameModal] = useState(false);
    const [pendingAddress, setPendingAddress] = useState('');
    const [newName, setNewName] = useState('');

    const [contactInfo, setContactInfo] = useState<{ name: string, phone: string } | null>(null);

    // Fetch Contact Info based on Current Location (Active Address)
    useEffect(() => {
        const fetchContactInfo = async () => {
            // If location is not set or invalid
            if (!location || location === '위치 설정이 필요합니다' || location === '위치 파악 실패') {
                setContactInfo({
                    name: '다산콜센터 (생활민원)',
                    phone: '120'
                });
                return;
            }

            // Parse location string (e.g., "서울특별시 마포구 ...")
            const parts = location.split(' ');
            const sido = parts[0];
            const sigungu = parts[1];
            const dong = parts[2];

            if (!sido || !sigungu) {
                setContactInfo({
                    name: '다산콜센터 (생활민원)',
                    phone: '120'
                });
                return;
            }

            try {
                const res = await fetch(`/api/waste-rules?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}&dong=${encodeURIComponent(dong || '')}`);
                const data = await res.json();

                if (data.rules && data.rules.length > 0) {
                    const rule = data.rules[0];
                    if (rule.contact) {
                        setContactInfo({
                            name: `${sigungu} 청소행정과`,
                            phone: rule.contact
                        });
                    } else {
                        setContactInfo({
                            name: '다산콜센터 (생활민원)',
                            phone: '120'
                        });
                    }
                } else {
                    setContactInfo({
                        name: '다산콜센터 (생활민원)',
                        phone: '120'
                    });
                }
            } catch (e) {
                console.error("Failed to fetch contact info", e);
                setContactInfo({
                    name: '다산콜센터 (생활민원)',
                    phone: '120'
                });
            }
        };

        fetchContactInfo();
    }, [location]);

    const handleAddressPicked = (addr: string) => {
        setPendingAddress(addr);
        setShowAddressSearch(false);
        setNewName(''); // Reset name
        setShowNameModal(true);
    };

    const handleSaveLocation = () => {
        if (!newName.trim()) return;
        addFavorite(newName, pendingAddress);
        // Automatically set as active location
        promoteFavorite(newName);

        setShowNameModal(false);
        // Reload to refresh context across app immediately
        setTimeout(() => {
            window.location.reload();
        }, 100);
    };

    const handleDeleteLocation = (name: string) => {
        if (confirm(`'${name}' 위치를 삭제하시겠습니까?`)) {
            removeFavorite(name);
        }
    };

    const handleLocationSelect = (fav: any) => {
        promoteFavorite(fav.name);
        // Force reload as requested to ensure all standard/admin info updates reflect immediately
        setTimeout(() => {
            window.location.reload();
        }, 100);
    };

    const primaryLocation = favorites.length > 0 ? favorites[0] : null;

    return (
        <div className={styles.container}>


            {/* Location Management Section */}
            <section className={styles.section}>
                <div className={styles.header}>내 위치 관리</div>
                <div className={styles.locationList}>
                    {favorites.length === 0 ? (
                        <div className={styles.emptyStateCard}>
                            <div className={styles.emptyIcon}>🏠</div>
                            <div className={styles.emptyTextWrapper}>
                                <div className={styles.emptyTitle}>등록된 위치가 없습니다</div>
                                <div className={styles.emptyDesc}>
                                    주소를 등록하면 배출 요일과<br />
                                    담당 부서를 바로 알려드려요!
                                </div>
                            </div>
                            <button className={styles.addBtnPrimary} onClick={() => setShowAddressSearch(true)}>
                                📍 우리 집 주소 등록하기
                            </button>
                        </div>
                    ) : (
                        <>
                            {favorites.map((fav, idx) => (
                                <div
                                    key={idx}
                                    className={`${styles.locationItem} ${idx === 0 ? styles.activeLocation : ''}`}
                                    onClick={() => handleLocationSelect(fav)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className={styles.locationInfo}>
                                        <span className={styles.locationName}>
                                            {fav.name === '우리집' ? '🏠' : fav.name === '회사' ? '🏢' : '📍'} {fav.name}
                                            {idx === 0 && <span className={styles.primaryBadge}>대표</span>}
                                        </span>
                                        <span className={styles.locationAddr}>{fav.address}</span>
                                    </div>
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteLocation(fav.name);
                                        }}
                                    >
                                        삭제
                                    </button>
                                </div>
                            ))}
                            <button className={styles.addBtnOutline} onClick={() => setShowAddressSearch(true)}>
                                <span>+ 다른 위치 추가하기</span>
                            </button>
                        </>
                    )}
                </div>
            </section>


            {/* Department Contact Section - Dynamic based on Location */}
            <section className={styles.section}>
                <div className={styles.header}>관할 구청 청소행정과</div>
                <div className={styles.contactList}>
                    {contactInfo ? (
                        <div className={styles.contactItem}>
                            <div className={styles.deptInfo}>
                                <div className={styles.deptIcon}>📞</div>
                                <div className={styles.deptText}>
                                    <span className={styles.deptName}>{contactInfo.name}</span>
                                    <span className={styles.deptRole}>폐기물 배출 및 수거 문의</span>
                                </div>
                            </div>
                            <a href={`tel:${contactInfo.phone}`} className={styles.callBtn}>
                                전화하기
                            </a>
                        </div>
                    ) : (
                        <div className={styles.contactItem} style={{ justifyContent: 'center', color: '#999' }}>
                            {favorites.length > 0 ? '해당 지역의 연락처 정보를 찾을 수 없습니다.' : '위치를 설정하면 담당 부서 연락처가 표시됩니다.'}
                        </div>
                    )}
                </div>
            </section>

            {/* System Info REMOVED */}

            {/* Modals */}
            {showAddressSearch && (
                <AddressSearch
                    onComplete={handleAddressPicked}
                    onClose={() => setShowAddressSearch(false)}
                />
            )}

            {showNameModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalTitle}>이 위치의 이름은 무엇인가요?</div>
                        <input
                            className={styles.modalInput}
                            placeholder="예: 우리집, 회사, 본가"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            autoFocus
                        />
                        <div className={styles.modalActions}>
                            <button className={styles.modalCancel} onClick={() => setShowNameModal(false)}>취소</button>
                            <button className={styles.modalSave} onClick={handleSaveLocation}>저장하기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
