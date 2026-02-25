import styles from './ChatSkeleton.module.css';
import Image from 'next/image';

interface ChatSkeletonProps {
    avatarUrl?: string;
}

export default function ChatSkeleton({ avatarUrl }: ChatSkeletonProps) {
    return (
        <div className={styles.skeletonWrapper}>
            <div className={styles.skeletonBubble}>
                <div className={styles.botHeader}>
                    {avatarUrl ? (
                        <div style={{ position: 'relative', width: '24px', height: '24px', marginRight: '8px' }}>
                            <Image
                                src={avatarUrl}
                                alt="Thinking Bot"
                                fill
                                sizes="24px"
                                style={{ borderRadius: '50%', objectFit: 'contain' }}
                            />
                        </div>
                    ) : (
                        <div className={styles.skeletonAvatar}></div>
                    )}
                    <div className={styles.skeletonName}></div>
                </div>
                <div className={`${styles.skeletonLine} ${styles.w80}`}></div>
                <div className={`${styles.skeletonLine} ${styles.w60}`}></div>
                <div className={`${styles.skeletonLine} ${styles.w40}`}></div>
            </div>
        </div>
    );
}
