'use client';

import { useUser } from '@/context/UserContext';
import styles from './StoreModal.module.css';

interface StoreModalProps {
    onClose: () => void;
}

export default function StoreModal({ onClose }: StoreModalProps) {
    const {
        tokens,
        isSubscribed,
        isAdmin,
        subscribe,
        unsubscribe,
        adTokensToday,
        addAdToken,
        purchaseTokens
    } = useUser();

    return (
        <div className={styles.storeModalOverlay} onClick={onClose}>
            <div className={styles.storeModalSheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.storeModalHeader}>
                    <div className={styles.storeModalTitle}>에코 상점</div>
                    <button className={styles.closeStoreBtn} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.storeModalContent}>
                    {/* User Status */}
                    <div className={styles.userStatus}>
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

                    {/* Token Cost Info */}
                    <div className={styles.tokenCostTable}>
                        <div className={styles.costItem}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                텍스트 질문
                            </span>
                            <span>1토큰</span>
                        </div>
                        <div className={styles.costItem}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                사진 분석
                            </span>
                            <span>2토큰</span>
                        </div>
                    </div>

                    {/* Subscription Section */}
                    {!isSubscribed ? (
                        <div className={styles.premiumCard}>
                            <div className={styles.premiumHeader}>
                                <span className={styles.premiumBadge}>Premium</span>
                                <span className={styles.premiumTitle}>에코 프로 구독</span>
                            </div>
                            <p className={styles.premiumDesc}>
                                광고 없이 무제한 질문 등 모든 기능을 자유롭게 이용하세요.
                            </p>
                            <button className={styles.subscribeBtn} disabled style={{ backgroundColor: '#ccc', cursor: 'default' }}>
                                준비중
                            </button>
                        </div>
                    ) : !isAdmin && (
                        <div className={styles.premiumCard}>
                            <div className={styles.premiumHeader}>
                                <span className={styles.premiumBadge}>Premium</span>
                                <span className={styles.premiumTitle}>에코 프로 이용 중</span>
                            </div>
                            <p className={styles.premiumDesc}>
                                현재 모든 기능을 무제한으로 사용하고 계십니다. 감사합니다!
                            </p>
                            <button className={styles.unsubscribeBtn} onClick={async () => {
                                if (confirm('구독을 취소하시겠습니까?\n취소 시 무제한 질문 및 알림 혜택이 사라집니다.')) {
                                    await unsubscribe();
                                    alert('구독이 취소되었습니다.');
                                }
                            }}>
                                구독 취소하기
                            </button>
                        </div>
                    )}

                    {/* Free Tokens Section */}
                    <div className={styles.freeTokenSection}>
                        <div className={styles.freeTokenInfo}>
                            <span className={styles.freeTokenTitle}> 광고 보고 무료 토큰 받기</span>
                            <span className={styles.freeTokenCount}>{adTokensToday}/3</span>
                        </div>
                        <button
                            className={styles.adBtnSmall}
                            onClick={async () => {
                                if (adTokensToday >= 3) {
                                    alert('오늘 받을 수 있는 무료 토큰을 모두 받았습니다.');
                                    return;
                                }

                                // Flutter 네이티브 광고 호출
                                if (typeof window !== 'undefined' && window.flutter_inappwebview) {
                                    console.log('Calling native rewarded ad...');
                                    window.flutter_inappwebview.callHandler('FlutterLoginChannel', 'showRewardedAd');
                                } else {
                                    // 앱이 아닌 브라우저 환경에서는 메시지만 표시
                                    alert('광고 기능은 모바일 앱에서만 작동합니다. (테스트 환경에서는 보상이 지급되지 않습니다)');
                                    console.warn('Native AdMob bridge not found. This is normal in a web browser.');
                                }
                            }}
                            disabled={adTokensToday >= 3}
                        >
                            {adTokensToday >= 3 ? '완료' : '광고 보기'}
                        </button>
                    </div>

                    {/* Purchase Grid */}
                    <div className={styles.storeGrid}>
                        <div className={styles.bundleCard}>
                            <div className={styles.bundleInfo}>
                                <span className={styles.bundleName}>토큰 10개</span>
                                <span className={styles.bundlePrice}>₩1,100</span>
                            </div>
                            <button className={styles.buyBtn} disabled style={{ backgroundColor: '#ccc', cursor: 'default' }}>준비중</button>
                        </div>
                        <div className={styles.bundleCard}>
                            <div className={styles.bundleInfo}>
                                <span className={styles.bundleName}>토큰 30개 (+5개)</span>
                                <span className={styles.bundlePrice}>₩3,300</span>
                            </div>
                            <button className={styles.buyBtn} disabled style={{ backgroundColor: '#ccc', cursor: 'default' }}>준비중</button>
                        </div>
                        <div className={styles.bundleCard}>
                            <div className={styles.bundleInfo}>
                                <span className={styles.bundleName}>토큰 100개 (대용량)</span>
                                <span className={styles.bundlePrice}>₩7,700</span>
                            </div>
                            <button className={styles.buyBtn} disabled style={{ backgroundColor: '#ccc', cursor: 'default' }}>준비중</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
