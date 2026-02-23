'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { useLocation } from '@/context/LocationContext';
import AddressSearch from '@/components/AddressSearch';
import { useUser } from '@/context/UserContext';

export default function Settings() {
    const { location, favorites, addFavorite, removeFavorite, updateFavorite, promoteFavorite, detectLocation } = useLocation();
    const { tokens, isSubscribed, isAdmin, subscribe, purchaseTokens, user, loginWithGoogle, logout } = useUser();
    const [showAddressSearch, setShowAddressSearch] = useState(false);
    const [showNameModal, setShowNameModal] = useState(false);
    const [pendingAddress, setPendingAddress] = useState('');
    const [newName, setNewName] = useState('');
    const [showStoreModal, setShowStoreModal] = useState(false);

    const [editTarget, setEditTarget] = useState<{ name: string, address: string } | null>(null);
    const [openMenu, setOpenMenu] = useState<string | null>(null);

    // Close menu when clicking outside
    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            // Check if click is inside a menu container using data attribute
            if ((e.target as Element).closest('[data-menu-container]')) return;
            setOpenMenu(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [contactInfo, setContactInfo] = useState<{ name: string, phone: string } | null>(null);

    const [notificationSettings, setNotificationSettings] = useState({
        general: false,
        recycle: false,
        food: false
    });

    const [wasteScheduler, setWasteScheduler] = useState({
        general: '정보 확인 중...',
        recycle: '정보 확인 중...',
        food: '정보 확인 중...'
    });

    // Load Notification Settings
    useEffect(() => {
        const saved = localStorage.getItem('notificationSettings');
        if (saved) {
            setNotificationSettings(JSON.parse(saved));
        }
    }, []);

    const handleToggleNotification = (key: 'general' | 'recycle' | 'food') => {
        const newSettings = { ...notificationSettings, [key]: !notificationSettings[key] };
        setNotificationSettings(newSettings);
        localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
    };

    // Fetch Contact Info & Rules based on Current Location (Active Address)
    useEffect(() => {
        const fetchInfo = async () => {
            // Default State
            const defaultContact = { name: '다산콜센터 (생활민원)', phone: '120' };
            const defaultScheduler = { general: '정보 없음', recycle: '정보 없음', food: '정보 없음' };

            // If location is not set or invalid
            if (!location || location === '위치 설정이 필요합니다' || location === '위치 파악 실패') {
                setContactInfo(defaultContact);
                setWasteScheduler(defaultScheduler);
                return;
            }

            // Parse location string (e.g., "서울특별시 마포구 ...")
            const parts = location.split(' ');
            const sido = parts[0];
            const sigungu = parts[1];
            const dong = parts[2];

            if (!sido || !sigungu) {
                setContactInfo(defaultContact);
                setWasteScheduler(defaultScheduler);
                return;
            }

            try {
                const res = await fetch(`/api/waste-rules?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}&dong=${encodeURIComponent(dong || '')}`);
                const data = await res.json();

                if (data.rules && data.rules.length > 0) {
                    const rule = data.rules[0];

                    // 1. Set Contact Info
                    if (rule.contact) {
                        setContactInfo({ name: `${sigungu} 청소행정과`, phone: rule.contact });
                    } else {
                        setContactInfo(defaultContact);
                    }

                    // 2. Set Scheduler Info
                    // Helper to format: "매일 19:00" or "화,목 전날 20:00"
                    const formatSchedule = (days: string, time: string) => {
                        if (!days) return '정보 없음';
                        const cleanTime = time ? time.split('~')[0].trim() : '19:00'; // Take start time
                        // Assuming time format is like "18:00~24:00" -> "18:00"

                        if (days.includes('매일')) return `매일 ${cleanTime} 알림`;
                        return `${days} 전날 ${cleanTime} 알림`;
                    };

                    setWasteScheduler({
                        general: formatSchedule(rule.gnrlWsteDschrgDay, rule.gnrlWsteDschrgTime),
                        recycle: formatSchedule(rule.recycleDschrgDay, rule.recycleDschrgTime),
                        food: formatSchedule(rule.foodWsteDschrgDay, rule.foodWsteDschrgTime)
                    });

                } else {
                    setContactInfo(defaultContact);
                    setWasteScheduler(defaultScheduler);
                }
            } catch (e) {
                console.error("Failed to fetch info", e);
                setContactInfo(defaultContact);
                setWasteScheduler(defaultScheduler);
            }
        };

        fetchInfo();
    }, [location]);

    const handleAddressPicked = (addr: string) => {
        setPendingAddress(addr);
        setShowAddressSearch(false);
        // Only clear name if adding new (not editing)
        if (!editTarget) {
            setNewName('');
        }
        setShowNameModal(true);
    };

    const handleDetectLocation = async () => {
        const { address, error } = await detectLocation();
        if (!error && address && !address.includes('실패') && !address.includes('미지원')) {
            handleAddressPicked(address); // Proceed to name modal with detected address
        } else {
            alert(address || error || "위치 확인 실패"); // Show error message
        }
    };

    const handleEditClick = (fav: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMenu(null); // Close menu
        setEditTarget(fav);
        setNewName(fav.name);
        setPendingAddress(fav.address);
        setShowNameModal(true);
    };

    const handleSaveLocation = () => {
        if (!newName.trim()) return;

        if (editTarget) {
            // Update existing
            updateFavorite(editTarget.name, newName, pendingAddress);
            setEditTarget(null);
        } else {
            // Add new
            addFavorite(newName, pendingAddress);
        }

        // Automatically set as active location (both add and edit)
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

    // Toggle Switch Component
    const Toggle = ({ active, onClick }: { active: boolean, onClick: () => void }) => (
        <div className={styles.switch} onClick={onClick}>
            <input type="checkbox" checked={active} readOnly />
            <span className={styles.slider}></span>
        </div>
    );

    return (
        <div className={styles.container}>


            {/* User Profile Bar (Compact) */}
            <section className={styles.section}>
                <div className={styles.userStatus} style={{ cursor: 'default', backgroundColor: '#F8F9FA' }}>
                    <div className={styles.statusLeft}>
                        <div className={styles.statusItem} style={{ alignItems: 'flex-start' }}>
                            <span className={styles.statusLabel}>로그인 계정</span>
                            <span className={styles.statusValue} style={{ fontSize: '0.9rem' }}>{user?.email || '비로그인'}</span>
                        </div>
                    </div>
                    {user && <button className={styles.logoutBtn} onClick={logout}>로그아웃</button>}
                </div>
            </section>

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
                                    <div className={styles.menuContainer} data-menu-container>
                                        <button
                                            className={`${styles.menuBtn} ${openMenu === fav.name ? styles.active : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation(); // Stop click from reaching parent card
                                                // Toggle menu
                                                setOpenMenu(prev => prev === fav.name ? null : fav.name);
                                            }}
                                            title="설정"
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="3"></circle>
                                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                            </svg>
                                        </button>
                                        {openMenu === fav.name && (
                                            <div className={styles.menuDropdown}>
                                                <button
                                                    className={styles.menuItem}
                                                    onClick={(e) => handleEditClick(fav, e)}
                                                >
                                                    수정
                                                </button>
                                                <button
                                                    className={`${styles.menuItem} ${styles.delete}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenu(null);
                                                        handleDeleteLocation(fav.name);
                                                    }}
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <button className={styles.addBtnOutline} onClick={() => setShowAddressSearch(true)}>
                                <span>+ 다른 위치 추가하기</span>
                            </button>
                        </>
                    )}
                </div>
            </section>



            {/* Store & Membership Section - Compact Entry */}
            <section className={styles.section}>
                <div className={styles.header}>에코 멤버십 & 상점</div>

                <div className={styles.userStatus} onClick={() => setShowStoreModal(true)}>
                    <div className={styles.statusLeft}>
                        <div className={styles.statusItem}>
                            <span className={styles.statusLabel}>보유 토큰</span>
                            <span className={styles.statusValue}>{isSubscribed ? '무제한' : `${tokens}개`}</span>
                        </div>
                        <div className={styles.statusItem}>
                            <span className={styles.statusLabel}>멤버십 상태</span>
                            <span className={styles.statusValue}>{isAdmin ? '관리자' : isSubscribed ? '프리미엄' : '일반'}</span>
                        </div>
                    </div>
                    <div className={styles.storeLink}>
                        충전 및 관리 <span>&rsaquo;</span>
                    </div>
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

            {/* Modals */}
            {showAddressSearch && (
                <AddressSearch
                    onComplete={handleAddressPicked}
                    onClose={() => setShowAddressSearch(false)}
                    onDetectLocation={handleDetectLocation}
                />
            )}

            {showNameModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalTitle}>{editTarget ? '위치 수정' : '이 위치의 이름은 무엇인가요?'}</div>

                        <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>주소</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <div style={{ flex: 1, fontSize: '0.9rem', padding: '0.6rem', backgroundColor: '#f8f9fa', borderRadius: '6px', color: '#333', wordBreak: 'keep-all', lineHeight: '1.4' }}>
                                    {pendingAddress}
                                </div>
                                <button
                                    onClick={() => { setShowAddressSearch(true); setShowNameModal(false); }}
                                    style={{ whiteSpace: 'nowrap', padding: '0.6rem 0.8rem', fontSize: '0.85rem', border: '1px solid #dee2e6', borderRadius: '6px', background: 'white', cursor: 'pointer', color: '#495057' }}
                                >
                                    주소 변경
                                </button>
                            </div>
                        </div>

                        <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>이름</label>
                            <input
                                className={styles.modalInput}
                                placeholder="예: 우리집, 회사, 본가"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className={styles.modalActions}>
                            <button className={styles.modalCancel} onClick={() => { setShowNameModal(false); setEditTarget(null); }}>취소</button>
                            <button className={styles.modalSave} onClick={handleSaveLocation}>저장하기</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Store Full-Screen Modal */}
            {showStoreModal && (
                <div className={styles.storeModalOverlay}>
                    <div className={styles.storeModalHeader}>
                        <div className={styles.storeModalTitle}>에코 상점</div>
                        <button className={styles.closeStoreBtn} onClick={() => setShowStoreModal(false)}>&times;</button>
                    </div>

                    <div className={styles.storeModalContent}>
                        <div className={styles.userStatus} style={{ cursor: 'default' }}>
                            <div className={styles.statusLeft}>
                                <div className={styles.statusItem}>
                                    <span className={styles.statusLabel}>보유 토큰</span>
                                    <span className={styles.statusValue}>{isSubscribed ? '무제한' : `${tokens}개`}</span>
                                </div>
                                <div className={styles.statusItem}>
                                    <span className={styles.statusLabel}>멤버십 상태</span>
                                    <span className={styles.statusValue}>{isAdmin ? '관리자' : isSubscribed ? '프리미엄' : '일반'}</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.tokenCostTable}>
                            <div className={styles.costItem}>
                                <span>📋 텍스트 질문</span>
                                <span>1토큰</span>
                            </div>
                            <div className={styles.costItem}>
                                <span>📷 사진 분석</span>
                                <span>2토큰</span>
                            </div>
                        </div>

                        {!isSubscribed && (
                            <div className={styles.premiumCard}>
                                <div className={styles.premiumHeader}>
                                    <span className={styles.premiumBadge}>Premium</span>
                                    <span className={styles.premiumTitle}>에코 프로 구독</span>
                                </div>
                                <p className={styles.premiumDesc}>
                                    광고 없이 무제한 질문, 배출 요일 알림 서비스 등 모든 기능을 자유롭게 이용하세요.
                                </p>
                                <button className={styles.subscribeBtn} onClick={() => {
                                    if (confirm('월 2,900원에 프리미엄 멤버십을 시작하시겠습니까?')) {
                                        subscribe();
                                        alert('축하합니다! 이제 에코 프로 회원입니다.');
                                    }
                                }}>
                                    월 2,900원에 시작하기
                                </button>
                            </div>
                        )}

                        <div className={styles.storeGrid}>
                            <div className={styles.bundleCard}>
                                <div className={styles.bundleInfo}>
                                    <span className={styles.bundleName}>토큰 10개</span>
                                    <span className={styles.bundlePrice}>₩1,100</span>
                                </div>
                                <button className={styles.buyBtn} onClick={() => {
                                    purchaseTokens(10);
                                    alert('토큰 10개가 충전되었습니다.');
                                }}>구매하기</button>
                            </div>
                            <div className={styles.bundleCard}>
                                <div className={styles.bundleInfo}>
                                    <span className={styles.bundleName}>토큰 30개 (+5개)</span>
                                    <span className={styles.bundlePrice}>₩3,300</span>
                                </div>
                                <button className={styles.buyBtn} onClick={() => {
                                    purchaseTokens(35);
                                    alert('토큰 35개가 충전되었습니다.');
                                }}>구매하기</button>
                            </div>
                            <div className={styles.bundleCard}>
                                <div className={styles.bundleInfo}>
                                    <span className={styles.bundleName}>토큰 100개 (대용량)</span>
                                    <span className={styles.bundlePrice}>₩7,700</span>
                                </div>
                                <button className={styles.buyBtn} onClick={() => {
                                    purchaseTokens(100);
                                    alert('토큰 100개가 충전되었습니다.');
                                }}>구매하기</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
