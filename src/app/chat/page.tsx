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
import { getJosa, extractKeyword, compressImage } from '@/lib/utils';

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

    // 파일 입력 Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 음성 인식 상태
    const [isListening, setIsListening] = useState(false);

    // 봇 생각 상태
    const [isThinking, setIsThinking] = useState(false);
    const [welcomeMascot, setWelcomeMascot] = useState('');
    const [loadingMascot, setLoadingMascot] = useState(MASCOT_IMAGES[0]);
    const [isImageLoaded, setIsImageLoaded] = useState(false);

    // 첨부 메뉴용 UI 상태
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showTokenModal, setShowTokenModal] = useState(false);
    const [isAdLoading, setIsAdLoading] = useState(false);

    const { tokens, isSubscribed, isAdmin, loading, adTokensToday, useToken, addAdToken, purchaseTokens, subscribe } = useUser();

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        // DOM이 업데이트되고 렌더링되었는지 확인하기 위해 약간의 타임아웃 사용
        setTimeout(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({
                    behavior,
                    block: 'end'
                });
            }
        }, behavior === 'auto' ? 0 : 100);
    };

    // 로컬 상태 대신 글로벌 상태 사용
    const { messages, addMessage, updateMessage } = useChat();
    const [input, setInput] = useState('');

    useEffect(() => {
        if (messages.length === 0) return;

        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.type === 'user') {
            // 사용자가 메시지를 보내면 즉시 해당 위치로 스크롤
            scrollToBottom('auto');
        } else {
            // 봇 메시지와 스켈레톤에 대해 부드러운 스크롤 적용
            scrollToBottom('smooth');
        }
    }, [messages, isThinking]);

    useEffect(() => {
        // 클라이언트 마운트 시 웰컴 마스코트 무작위 설정
        const randomMascot = MASCOT_IMAGES[Math.floor(Math.random() * MASCOT_IMAGES.length)];
        setWelcomeMascot(randomMascot);
    }, []);

    // (utils.ts로 이동됨)

    // 이미지를 처리할 수 있도록 업데이트된 fetch 함수
    const fetchRecycleInfo = async (queryMock: string, imageBase64?: string, mimeType?: string) => {
        setIsThinking(true);
        // 매번 로딩 마스코트 무작위 설정
        setLoadingMascot(MASCOT_IMAGES[Math.floor(Math.random() * MASCOT_IMAGES.length)]);

        let data;
        let usedKeyword = queryMock;
        let usedModifier = null;

        try {
            if (imageBase64) {
                // 이미지 분석 (Vision API는 JSON 형식이 더 간단하므로 JSON 유지)
                const res = await fetch('/api/vision', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: imageBase64, mimeType, location })
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || '사진 분석 중 오류가 발생했습니다.');
                }

                if (data.resultType === 'gemini') {
                    addMessage({
                        id: Date.now() + Math.random(),
                        type: 'bot',
                        content: <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}><FormattedText text={data.message} /></div>,
                        source: '제공: 에코 이미지 분석 서비스',
                        avatarUrl: MASCOT_IMAGES[Math.floor(Math.random() * MASCOT_IMAGES.length)],
                        isError: false
                    });
                } else if (data.resultType === 'list') {
                    // 데이터 리스트 폴백
                    const items = data.response?.body?.items || [];
                    const content = items.length > 0
                        ? `"${data.identifiedItem || '사진 속 물체'}"에 대해 찾은 검색 결과입니다:`
                        : `"${data.identifiedItem || '사진 속 물체'}"에 대한 정확한 정보를 찾지 못했습니다.`;

                    addMessage({
                        id: Date.now() + Math.random(),
                        type: 'bot',
                        content: (
                            <div>
                                <p style={{ marginBottom: '12px' }}>{content}</p>
                                {items.slice(0, 5).map((item: any, idx: number) => (
                                    <div key={idx} style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '8px', marginBottom: '8px', fontSize: '0.9rem' }}>
                                        <strong>{item.itemNm || item.larWasNm}</strong>
                                        <p style={{ marginTop: '4px', color: '#666' }}>{item.dschgMthd || `${item.fee}원`}</p>
                                    </div>
                                ))}
                                {items.length === 0 && <p style={{ color: '#888', fontSize: '0.85rem' }}>다른 이름으로 검색하거나 직접 문의해 주세요. ☎ 120</p>}
                            </div>
                        ),
                        source: '정보 제공: 기후에너지환경부, 한국환경공단',
                        avatarUrl: MASCOT_IMAGES[0],
                        isError: false
                    });
                }
            } else {
                // 텍스트 요청 (스트리밍)
                const { keyword } = extractKeyword(queryMock);
                const locationParam = location && location !== '위치 설정이 필요합니다' && location !== '위치 파악 실패'
                    ? `&loc=${encodeURIComponent(location)}`
                    : '';

                const res = await fetch(`/api/recycle?q=${encodeURIComponent(keyword)}${locationParam}`);

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || '답변을 생성하는 중에 오류가 발생했습니다.');
                }

                const reader = res.body?.getReader();
                const textDecoder = new TextDecoder();

                if (!reader) {
                    throw new Error('응답 데이터를 읽을 수 없습니다.');
                }

                const botMessageId = Date.now() + Math.random();
                // 초기 빈 봇 메시지 추가
                addMessage({
                    id: botMessageId,
                    type: 'bot',
                    content: '',
                    avatarUrl: MASCOT_IMAGES[0],
                    isError: false
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
                    source: '정보 제공: 기후에너지환경부, 한국환경공단, 한국지능정보사회진흥원',
                    isError: false
                });
            }

        } catch (error: any) {
            console.error("Chat Error", error);
            addMessage({
                id: Date.now(),
                type: 'bot',
                content: error.message || '죄송해요, 서비스 연결 중에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
                avatarUrl: '/images/eco_mascot_no.png',
                isError: true
            });
        } finally {
            setIsThinking(false);
        }
    };

    const handleVoiceInput = () => {
        setShowAttachMenu(false); // 선택 시 메뉴 닫기

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

        try {
            recognition.start();
        } catch (e) {
            console.error("Speech Recognition Start Error:", e);
            setIsListening(false);
            return;
        }

        recognition.onresult = (event: any) => {
            const speechResult = event.results[0][0].transcript;
            setInput(speechResult);
            sendMessage(speechResult); // 자동 전송/검색
            setIsListening(false);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech Error", event.error);
            setIsListening(false);

            if (event.error === 'not-allowed') {
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
                const isWebView = /wv|Webview/i.test(navigator.userAgent);

                if (isWebView) {
                    alert("앱의 마이크 권한이 꺼져 있거나 웹뷰에서 차단되었습니다.\n\n해결 방법:\n1. 휴대폰 [설정 > 애플리케이션 > 에코(앱 이름) > 권한]\n2. '마이크' 권한을 '허용'으로 변경해 주세요. 🎤");
                } else if (isIOS) {
                    alert("마이크 사용 권한이 필요합니다.\n\n해결 방법:\n1. Safari 주소창 'AA' 아이콘 클릭\n2. [웹 사이트 설정] 메뉴 선택\n3. 마이크 권한을 '허용'으로 변경해 주세요. 🎤");
                } else {
                    alert("마이크 권한이 필요합니다. 브라우저 설정에서 마이크 허용을 눌러주세요. 🎤");
                }
            } else if (event.error === 'no-speech') {
                // 무시
            } else {
                alert("음성 인식 오류: " + event.error);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
        };
    };

    const handleImageClick = () => {
        console.log('Mobile Bridge: Chat Photo button clicked');
        setShowAttachMenu(false);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        } else {
            console.error('Mobile Bridge: fileInputRef is null');
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log('Mobile Bridge: handleImageUpload triggered');
        const file = e.target.files?.[0];
        if (!file) {
            console.log('Mobile Bridge: No file selected');
            return;
        }

        console.log('Mobile Bridge: File selected:', file.name, file.size);
        if (!isSubscribed && tokens < 2 && !isAdmin) {
            setShowTokenModal(true);
            return;
        }

        setIsThinking(true); // 압축 전 로딩 표시

        try {
            // 사진의 경우 용량이 매우 클 수 있으므로 압축
            console.log('Mobile Bridge: Compressing image...');
            const base64 = await compressImage(file);
            console.log('Mobile Bridge: Compression complete. Length:', base64.length);

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
                } else {
                    console.error('Mobile Bridge: Invalid base64 format');
                }
            } else {
                console.warn('Mobile Bridge: Insufficient tokens');
                setShowTokenModal(true);
                setIsThinking(false);
            }
        } catch (error: any) {
            console.error("Mobile Bridge: Image Upload Error:", error);
            alert(error.message || "이미지를 처리하는 중 오류가 발생했습니다.");
            setIsThinking(false);
        }

        e.target.value = '';
    };

    // ... scroll effect ...

    useEffect(() => {
        const processPendingImage = async () => {
            if (loading) return; // 유저 데이터가 아직 로딩 중이면 기다림

            const pendingImage = localStorage.getItem('pendingImage');
            if (pendingImage) {
                console.log('Mobile Bridge: Found pending image in localStorage. Processing...');
                if (!isSubscribed && tokens < 2 && !isAdmin) {
                    console.warn('Mobile Bridge: Insufficient tokens for pending image');
                    setShowTokenModal(true);
                    localStorage.removeItem('pendingImage');
                    return;
                }

                setIsThinking(true);

                try {
                    console.log('Mobile Bridge: Requesting 2 tokens for photo analysis...');
                    const hasToken = await useToken(2);
                    if (hasToken) {
                        const matches = pendingImage.match(/^data:(.+);base64,(.+)$/);
                        if (matches) {
                            const mimeType = matches[1];
                            const base64Data = matches[2];

                            console.log('Mobile Bridge: Sending pending image to API. MimeType:', mimeType, 'Length:', base64Data.length);
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
                        } else {
                            console.error('Mobile Bridge: Invalid image data format in localStorage');
                        }
                    } else {
                        console.warn('Mobile Bridge: Token check failed: User has less than 2 tokens.');
                        setShowTokenModal(true);
                        setIsThinking(false);
                    }
                } catch (error) {
                    console.error("Mobile Bridge: Critical Pending Image Error:", error);
                    setIsThinking(false);
                }
                localStorage.removeItem('pendingImage');
            } else {
                console.log('Mobile Bridge: No pending image found in localStorage.');
            }
        };

        processPendingImage();
    }, [tokens, isSubscribed, isAdmin, loading]);

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
                style={{
                    display: 'none'
                }}
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

                                {msg.type === 'bot' && !msg.isError && (
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
                {isListening && (
                    <div className={styles.listeningOverlay}>
                        <div className={styles.listeningTitle}>듣고 있습니다</div>
                        <div className={styles.waveContainer}>
                            <div className={styles.wave}></div>
                            <div className={styles.wave}></div>
                            <div className={styles.wave}></div>
                            <div className={styles.wave}></div>
                            <div className={styles.wave}></div>
                        </div>
                        <div className={styles.micCircle}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        </div>
                        <p className={styles.listeningHint}>말씀이 끝나면 자동으로 분석을 시작합니다</p>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
                <div className={`${styles.attachMenu} ${showAttachMenu ? styles.show : ''}`}>
                    <button type="button" className={styles.attachBtn} onClick={handleImageClick}>
                        <div className={styles.attachIconCircle}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="2">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                <circle cx="12" cy="13" r="4" />
                            </svg>
                        </div>
                        <div className={styles.attachLabelWrapper}>
                            <span className={styles.attachLabel}>사진 분석</span>
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
