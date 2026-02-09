import styles from './ChatSkeleton.module.css';

interface ChatSkeletonProps {
    avatarUrl?: string;
}

export default function ChatSkeleton({ avatarUrl }: ChatSkeletonProps) {
    return (
        <div className={styles.skeletonWrapper}>
            <div className={styles.skeletonBubble}>
                <div className={styles.botHeader}>
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Thinking Bot" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'contain', marginRight: '8px' }} />
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
