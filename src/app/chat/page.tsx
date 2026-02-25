'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import { useChat } from '@/context/ChatContext';
import { useLocation } from '@/context/LocationContext';
import ChatSkeleton from './ChatSkeleton';
import FormattedText from '@/components/FormattedText';
import Image from 'next/image';
import { useUser } from '@/context/UserContext';

const MASCOT_IMAGES = [
    '/images/eco_mascot_thinking.png',
    '/images/eco_mascot_idea.png',
    '/images/eco_mascot_finish.png',
    '/images/eco_mascot_welcome.png',
];


function FeedbackButtons() {
    const [activeType, setActiveType] = useState<'positive' | 'negative' | null>(null);

    const handleClick = (type: 'positive' | 'negative') => {
        if (activeType) return;
        setActiveType(type);
        setTimeout(() => setActiveType(null), 1000);
    };

    return (
        <div className={styles.feedbackContainer}>
            <button
                className={`${styles.feedbackBtn} ${activeType === 'positive' ? styles.activeFeedback : ''}`}
                onClick={() => handleClick('positive')}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                도움됨
            </button>
            <button
                className={`${styles.feedbackBtn} ${activeType === 'negative' ? styles.activeFeedback : ''}`}
                onClick={() => handleClick('negative')}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2H20a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>
                아쉬움
            </button>
        </div>
    );
}

function ChatContent() {
    const searchParams = useSearchParams();
    const lastHandledQuery = useRef<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { location } = useLocation();

    // File Input Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Voice Recognition State
    const [isListening, setIsListening] = useState(false);

    // Bot Thinking State
    const [isThinking, setIsThinking] = useState(false);
    const [welcomeMascot, setWelcomeMascot] = useState('');
    const [loadingMascot, setLoadingMascot] = useState(MASCOT_IMAGES[0]);
    const [isImageLoaded, setIsImageLoaded] = useState(false);

    // UI State for Attach Menu
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showTokenModal, setShowTokenModal] = useState(false);
    const [isAdLoading, setIsAdLoading] = useState(false);

    const { tokens, isSubscribed, isAdmin, adTokensToday, useToken, addAdToken, purchaseTokens, subscribe } = useUser();

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        // Use a small timeout to ensure DOM has updated and rendered
        setTimeout(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({
                    behavior,
                    block: 'end'
                });
            }
        }, behavior === 'auto' ? 0 : 100);
    };

    // Use global state instead of local state
    const { messages, addMessage, updateMessage } = useChat();
    const [input, setInput] = useState('');

    useEffect(() => {
        if (messages.length === 0) return;

        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.type === 'user') {
            // When user sends a message, scroll immediately to it
            scrollToBottom('auto');
        } else {
            // Smooth scroll for bot messages and skeleton
            scrollToBottom('smooth');
        }
    }, [messages, isThinking]);

    useEffect(() => {
        // Randomize welcome mascot on client mount
        const randomMascot = MASCOT_IMAGES[Math.floor(Math.random() * MASCOT_IMAGES.length)];
        setWelcomeMascot(randomMascot);
    }, []);

    const getJosa = (word: string, josa: '은/는' | '이/가' | '을/를') => {
        if (!word) return '';
        let lastCharIndex = word.length - 1;
        while (lastCharIndex >= 0) {
            const code = word.charCodeAt(lastCharIndex);
            if (code >= 0xAC00 && code <= 0xD7A3) break;
            lastCharIndex--;
        }
        if (lastCharIndex < 0) return josa;
        const lastCharCode = word.charCodeAt(lastCharIndex);
        const hasBatchim = (lastCharCode - 0xAC00) % 28 > 0;
        if (josa === '은/는') return hasBatchim ? '은' : '는';
        if (josa === '이/가') return hasBatchim ? '이' : '가';
        if (josa === '을/를') return hasBatchim ? '을' : '를';
        return josa;
    };

    const extractKeyword = (text: string) => {
        let cleanText = text.replace(/[?.!,]/g, '').trim();
        let modifier: string | null = null;
        if (cleanText.includes('묻은') || cleanText.includes('더러운') || cleanText.includes('음식물') || cleanText.includes('이물질')) modifier = 'dirty';
        else if (cleanText.includes('깨진') || cleanText.includes('파손된')) modifier = 'broken';
        else if (cleanText.includes('액체') || cleanText.includes('남은') || cleanText.includes('내용물')) modifier = 'liquid';
        else if (cleanText.includes('기름')) modifier = 'oil';

        const removePhrases = ['어떻게 버려요', '어떻게 버리나요', '어떻게 버려', '어떻게 처리해요', '버리는 법', '버리는 방법', '버리는법', '배출 방법', '배출법', '알려줘', '알려주세요', '어떻게', '버려요', '버려', '요', '처리', '수거', '폐기'];
        for (const phrase of removePhrases) {
            if (cleanText.endsWith(phrase)) cleanText = cleanText.substring(0, cleanText.length - phrase.length).trim();
        }
        return { keyword: cleanText, modifier };
    };

    // Updated fetch function to handle Image
    const fetchRecycleInfo = async (queryMock: string, imageBase64?: string, mimeType?: string) => {
        setIsThinking(true);
        // Randomize loading mascot each time
        setLoadingMascot(MASCOT_IMAGES[Math.floor(Math.random() * MASCOT_IMAGES.length)]);

        let data;
        let usedKeyword = queryMock;
        let usedModifier = null;

        try {
            if (imageBase64) {
                // Image Analysis (Keep JSON for Vision as it's simpler)
                const res = await fetch('/api/vision', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: imageBase64, mimeType, location })
                });
                const data = await res.json();

                if (data.resultType === 'gemini') {
                    addMessage({
                        id: Date.now() + Math.random(),
                        type: 'bot',
                        content: <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}><FormattedText text={data.message} /></div>,
                        source: '제공: 에코 이미지 분석 서비스',
                        avatarUrl: MASCOT_IMAGES[Math.floor(Math.random() * MASCOT_IMAGES.length)]
                    });
                }
            } else {
                // Text Request (Streaming)
                const { keyword } = extractKeyword(queryMock);
                const locationParam = location && location !== '위치 설정이 필요합니다' && location !== '위치 파악 실패'
                    ? `&loc=${encodeURIComponent(location)}`
                    : '';

                const res = await fetch(`/api/recycle?q=${encodeURIComponent(keyword)}${locationParam}`);

                if (!res.ok) {
                    throw new Error('API request failed');
                }

                const reader = res.body?.getReader();
                const decoder = new TextEncoder();
                const textDecoder = new TextDecoder();

                if (!reader) return;

                const botMessageId = Date.now() + Math.random();
                // Add initial empty bot message
                addMessage({
                    id: botMessageId,
                    type: 'bot',
                    content: '',
                    avatarUrl: MASCOT_IMAGES[0]
                });

                let fullText = '';
                let firstChunk = true;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    if (firstChunk) {
                        setIsThinking(false);
                        firstChunk = false;
                    }

                    const chunk = textDecoder.decode(value, { stream: true });
                    fullText += chunk;

                    updateMessage(botMessageId, (
                        <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                            <FormattedText text={fullText} />
                        </div>
                    ));
                }

                // Final update with source in the dedicated field
                updateMessage(botMessageId, {
                    content: (
                        <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                            <FormattedText text={fullText} />
                        </div>
                    ),
                    source: '정보 제공: 기후에너지환경부, 한국환경공단, 한국지능정보사회진흥원'
                });
            }

        } catch (error) {
            console.error("Chat Error", error);
            addMessage({ id: Date.now(), type: 'bot', content: '오류가 발생했습니다.', avatarUrl: '/images/eco_mascot_no.png' });
        } finally {
            setIsThinking(false);
        }
    };

    const handleVoiceInput = () => {
        setShowAttachMenu(false); // Close menu on selection
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.lang = 'ko-KR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        setIsListening(true);
        recognition.start();

        recognition.onresult = (event: any) => {
            const speechResult = event.results[0][0].transcript;
            setInput(speechResult);
            sendMessage(speechResult); // Auto send/search
            setIsListening(false);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech Error", event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                alert("마이크 권한이 필요합니다. 브라우저 주소창 옆의 자물쇠 아이콘을 눌러 마이크 허용을 해주세요. 🎤");
            } else if (event.error === 'no-speech') {
                // User didn't say anything, just reset silently or mild toast
            } else {
                alert("음성 인식 오류: " + event.error);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
        };
    };

    const handleCameraClick = () => {
        setShowAttachMenu(false);
        fileInputRef.current?.click();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!isSubscribed && tokens < 2 && !isAdmin) {
            setShowTokenModal(true);
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;

            const hasToken = await useToken(2);
            if (hasToken) {
                const matches = base64.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    const mimeType = matches[1];
                    const base64Data = matches[2];

                    addMessage({
                        id: Date.now(),
                        type: 'user',
                        content: (
                            <div>
                                <img
                                    src={base64}
                                    alt="Uploaded Waste"
                                    style={{ maxWidth: '100%', borderRadius: '12px', marginBottom: '8px', display: 'block' }}
                                />
                                <span>📷 사진을 분석중입니다 (2토큰 사용)</span>
                            </div>
                        )
                    });

                    fetchRecycleInfo("image", base64Data, mimeType);
                }
            } else {
                setShowTokenModal(true);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    useEffect(() => {
        const processPendingImage = async () => {
            const pendingImage = sessionStorage.getItem('pendingImage');
            if (pendingImage) {
                if (!isSubscribed && tokens < 2 && !isAdmin) {
                    setShowTokenModal(true);
                    sessionStorage.removeItem('pendingImage');
                    return;
                }

                const hasToken = await useToken(2);
                if (hasToken) {
                    const matches = pendingImage.match(/^data:(.+);base64,(.+)$/);
                    if (matches) {
                        const mimeType = matches[1];
                        const base64Data = matches[2];

                        addMessage({
                            id: Date.now(),
                            type: 'user',
                            content: (
                                <div>
                                    <img
                                        src={pendingImage}
                                        alt="Uploaded Waste"
                                        style={{ maxWidth: '100%', borderRadius: '12px', marginBottom: '8px', display: 'block' }}
                                    />
                                    <span>📷 사진을 분석중입니다 (2토큰 사용)</span>
                                </div>
                            )
                        });

                        fetchRecycleInfo("image", base64Data, mimeType);
                    }
                } else {
                    setShowTokenModal(true);
                }
                sessionStorage.removeItem('pendingImage');
            }
        };

        processPendingImage();
    }, [tokens, isSubscribed, isAdmin]);

    useEffect(() => {
        const query = searchParams.get('q');
        const mode = searchParams.get('mode');

        if (query && query !== lastHandledQuery.current) {
            lastHandledQuery.current = query;
            sendMessage(query);
        } else if (mode === 'voice') {
            setTimeout(() => {
                handleVoiceInput();
            }, 500);
        }
    }, [searchParams]);

    const [chatPlaceholder, setChatPlaceholder] = useState('텍스트 1토큰 / 사진 2토큰');

    useEffect(() => {
        const examples = [
            '예: 깨진 유리, 깨진 그릇',
            '예: 아이스팩, 보냉가방',
            '예: 매트리스, 대형 가구',
            '예: 유통기한 지난 약',
            '예: 프라이팬, 냄비',
            '예: 형광등, 건전지'
        ];
        const randomIndex = Math.floor(Math.random() * examples.length);
        setChatPlaceholder(examples[randomIndex]);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        sendMessage(input);
    };

    const sendMessage = async (text: string) => {
        if (!isSubscribed && tokens < 1 && !isAdmin) {
            setShowTokenModal(true);
            return;
        }

        const hasToken = await useToken(1);
        if (hasToken) {
            addMessage({ id: Date.now(), type: 'user', content: text });
            setInput('');
            fetchRecycleInfo(text);
        } else {
            setShowTokenModal(true);
        }
    };

    const handleWatchAd = async () => {
        setIsAdLoading(true);
        const success = await addAdToken();
        setIsAdLoading(false);
        if (success) {
            setShowTokenModal(false);
            alert('광고 시청 완료! 토큰 1개가 충전되었습니다.');
        } else {
            alert('오늘의 광고 시청 횟수(3회)를 모두 사용했습니다.');
        }
    };

    return (
        <div className={styles.container}>
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleImageUpload}
            />

            <div className={styles.messagesArea}>
                {messages.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.mascotContainer}>
                            {welcomeMascot && (
                                <Image
                                    src={welcomeMascot}
                                    alt="Welcome"
                                    width={120}
                                    height={120}
                                    className={`${styles.mascotImage} ${isImageLoaded ? styles.loaded : ''}`}
                                    onLoad={() => setIsImageLoaded(true)}
                                    priority
                                />
                            )}
                        </div>
                        <h2 className={styles.welcomeText}>무엇이든 물어봐주세요!</h2>
                        <p className={styles.costHint}>
                            {isSubscribed ? '에코 프로 멤버십 혜택으로 무제한 이용 중입니다.' : '텍스트 질문은 1토큰, 사진 분석은 2토큰이 사용됩니다.'}
                        </p>

                        <div className={styles.suggestions}>
                            {['깨진 그릇은 어떻게 버려요?', '오늘 배출 가능한 품목은?', '폐가전 무료 수거 방법', '아이스팩 처리 방법'].map((question, idx) => (
                                <button
                                    key={idx}
                                    className={styles.chip}
                                    onClick={() => sendMessage(question)}
                                >
                                    {question}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`${styles.messageWrapper} ${msg.type === 'user' ? styles.userWrapper : styles.botWrapper}`}>
                            <div className={`${styles.bubble} ${msg.type === 'user' ? styles.userBubble : styles.botBubble}`}>
                                {msg.type === 'bot' && (
                                    <div className={styles.botHeader}>
                                        [에코 봇]
                                    </div>
                                )}
                                <div>{msg.content}</div>

                                {msg.type === 'bot' && (
                                    <div className={styles.botFooter}>
                                        <div className={styles.source}>
                                            📚 {msg.source || '출처: 환경부 재활용품 분리배출 가이드라인 (2025)'}
                                        </div>
                                        <FeedbackButtons />
                                        <div className={styles.disclaimer}>
                                            * 정확한 정보는 관할 구청 청소행정과 위생과(☎ 120)로 확인 부탁드립니다.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
                {isThinking && <ChatSkeleton avatarUrl={loadingMascot} />}
                {isListening && <div className={styles.listeningOverlay}>🎤 듣고 있어요...</div>}
                <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
                <div className={`${styles.attachMenu} ${showAttachMenu ? styles.show : ''}`}>
                    <button type="button" className={styles.attachBtn} onClick={handleCameraClick}>
                        <div className={styles.attachIconCircle}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                        </div>
                        <div className={styles.attachLabelWrapper}>
                            <span className={styles.attachLabel}>사진</span>
                            <span className={styles.tokenCostTag}>2토큰</span>
                        </div>
                    </button>
                    <button type="button" className={styles.attachBtn} onClick={handleVoiceInput}>
                        <div className={styles.attachIconCircle}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                        </div>
                        <div className={styles.attachLabelWrapper}>
                            <span className={styles.attachLabel}>음성</span>
                            <span className={styles.tokenCostTag}>1토큰</span>
                        </div>
                    </button>
                </div>

                <form className={styles.inputWrapper} onSubmit={handleSubmit}>
                    <button type="button" className={`${styles.plusBtn} ${showAttachMenu ? styles.active : ''}`} onClick={() => setShowAttachMenu(!showAttachMenu)}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>

                    <input type="text" className={styles.input} placeholder={chatPlaceholder} value={input} onChange={(e) => setInput(e.target.value)} onClick={() => setShowAttachMenu(false)} />

                    <button type="submit" className={styles.sendBtn}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                    </button>
                </form>
            </div>

            {showTokenModal && (
                <div className={styles.modalOverlay} onClick={() => setShowTokenModal(false)}>
                    <div className={styles.tokenModal} onClick={(e) => e.stopPropagation()}>
                        {isAdLoading ? (
                            <div className={styles.adLoading}>
                                <div className={styles.spinner}></div>
                                <p>광고를 불러오는 중입니다...</p>
                            </div>
                        ) : (
                            <>
                                <div className={styles.modalIcon}>{isSubscribed ? '✨' : '💎'}</div>
                                <div className={styles.modalTitle}>{isSubscribed ? '에코 멤버십' : '토큰이 부족해요!'}</div>
                                {!isSubscribed && (
                                    <div className={styles.tokenCostInfo}>
                                        <div className={styles.costRow}><span>텍스트 질문</span> <span>1토큰</span></div>
                                        <div className={styles.costRow}><span>사진 분석</span> <span>2토큰</span></div>
                                    </div>
                                )}
                                <p className={styles.modalDesc}>
                                    {isSubscribed ? (
                                        <>프리미엄 멤버십을 이용 중입니다.<br />모든 기능을 무제한으로 즐겨보세요! ✨</>
                                    ) : (
                                        <>계속 질문하려면 광고를 보거나<br />토큰을 충전해 주세요.</>
                                    )}
                                </p>

                                <div className={styles.rechargeGrid}>
                                    <button
                                        className={`${styles.rechargeBtn} ${styles.rewardBtn} ${isSubscribed ? styles.subscribedBtn : ''}`}
                                        onClick={isSubscribed ? undefined : handleWatchAd}
                                        disabled={isSubscribed || isAdLoading}
                                    >
                                        <div className={styles.rechargeLabel}>
                                            📺 <span>광고 보고 충전</span>
                                        </div>
                                        <span className={styles.rechargeValue} style={{ color: isSubscribed ? '#999' : 'white' }}>
                                            {isSubscribed ? '무제한 이용 중' : `무료 (오늘 ${adTokensToday}/3)`}
                                        </span>
                                    </button>

                                    <button
                                        className={`${styles.rechargeBtn} ${isSubscribed ? styles.subscribedBtn : ''}`}
                                        onClick={() => {
                                            if (isSubscribed) return;
                                            if (confirm('토큰 10개를 1,100원에 구매하시겠습니까?')) {
                                                purchaseTokens(10);
                                                setShowTokenModal(false);
                                                alert('구매 완료!');
                                            }
                                        }}
                                        disabled={isSubscribed}
                                    >
                                        <div className={styles.rechargeLabel}>
                                            💎 <span>토큰 10개 구매</span>
                                        </div>
                                        <span className={styles.rechargeValue}>{isSubscribed ? '혜택 적용 중' : '₩1,100'}</span>
                                    </button>

                                    <button
                                        className={`${styles.rechargeBtn} ${isSubscribed ? styles.subscribedBtn : ''}`}
                                        style={{ borderColor: isSubscribed ? '#e0e0e0' : '#10B981' }}
                                        onClick={() => {
                                            if (isSubscribed) return;
                                            if (confirm('월 2,900원에 프리미엄 멤버십을 시작하시겠습니까?')) {
                                                subscribe();
                                                setShowTokenModal(false);
                                                alert('프리미엄 회원이 되신 것을 환영합니다!');
                                            }
                                        }}
                                        disabled={isSubscribed}
                                    >
                                        <div className={styles.rechargeLabel}>
                                            ✨ <span>{isSubscribed ? '에코 프로 이용 중' : '에코 프로 구독'}</span>
                                        </div>
                                        <span className={styles.rechargeValue}>{isSubscribed ? '프리미엄 회원' : '월 ₩2,900'}</span>
                                    </button>
                                </div>

                                <span className={styles.closeModal} onClick={() => setShowTokenModal(false)}>다음에 할게요</span>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function Chat() {
    return (
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '2rem', color: '#666' }}>로딩중...</div>}>
            <ChatContent />
        </Suspense>
    );
}
