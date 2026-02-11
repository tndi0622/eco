'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import { useChat } from '@/context/ChatContext';
import { useLocation } from '@/context/LocationContext';
import ChatSkeleton from './ChatSkeleton';

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
    const [welcomeMascot, setWelcomeMascot] = useState('/images/eco_mascot_welcome.png');
    const [loadingMascot, setLoadingMascot] = useState('/images/eco_mascot_thinking.png');

    // UI State for Attach Menu
    const [showAttachMenu, setShowAttachMenu] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Use global state instead of local state
    const { messages, addMessage } = useChat();
    const [input, setInput] = useState('');

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking]);

    const MASCOT_IMAGES = [
        '/images/eco_mascot_icon.png',
        '/images/eco_mascot_thinking.png',
        '/images/eco_mascot_idea.png',
        '/images/eco_mascot_finish.png',
        '/images/eco_mascot_welcome.png',
    ];

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
                // Image Analysis Request
                const res = await fetch('/api/vision', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: imageBase64, mimeType, location }) // Send location too
                });
                data = await res.json();
                usedKeyword = "이미지 분석 결과";
            } else {
                // Text Request
                const { keyword, modifier } = extractKeyword(queryMock);
                usedKeyword = keyword;
                usedModifier = modifier;

                const locationParam = location && location !== '위치 설정이 필요합니다' && location !== '위치 파악 실패'
                    ? `&loc=${encodeURIComponent(location)}`
                    : '';

                const res = await fetch(`/api/recycle?q=${encodeURIComponent(keyword)}${locationParam}`);
                data = await res.json();
            }

            let content: React.ReactNode = '검색 결과가 없습니다.';
            let source = '출처: 행정안전부_생활쓰레기배출정보';

            if (data.resultType === 'gemini') {
                content = (
                    <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                        {data.message}
                    </div>
                );
                // ... (Bot message creation similar to before)
                const randomImage = MASCOT_IMAGES[Math.floor(Math.random() * MASCOT_IMAGES.length)];
                addMessage({
                    id: Date.now() + Math.random(),
                    type: 'bot',
                    content: content,
                    source: source,
                    avatarUrl: randomImage
                });
            } else if (data.response && data.response.body) {
                // Existing Legacy Logic ...
                // (Simplified for brevity in replacement, but keeping original logic structure is crucial)
                // Copying logic from original file...
                source = '출처: 행정안전부_생활쓰레기배출정보';
                const rawItems = data.response?.body?.items;
                let realItems: any[] = [];
                if (rawItems) {
                    if (Array.isArray(rawItems)) realItems = rawItems;
                    else if (Array.isArray(rawItems.item)) realItems = rawItems.item;
                    else if (rawItems.item) realItems = [rawItems.item];
                }

                if (realItems.length > 0) {
                    // ... rendering list ...
                    content = (
                        <div>
                            {usedModifier && (
                                <div style={{ backgroundColor: '#FFF3E0', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.95rem', borderLeft: '4px solid #FF9800' }}>
                                    <p>💡 <strong>참고하세요!</strong><br />이물질이나 파손 여부를 꼭 확인해주세요.</p>
                                </div>
                            )}
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {realItems.map((item: any, idx: number) => (
                                    <li key={idx} style={{ marginBottom: '1rem', lineHeight: '1.5' }}>
                                        <span style={{ color: '#27AE60', fontWeight: 'bold' }}>{item.itemNm || item.prdctNm}</span>
                                        {getJosa(item.itemNm || item.prdctNm, '은/는')} <br />
                                        <strong>{item.dschgMthd || item.contents}</strong>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                    addMessage({ id: Date.now(), type: 'bot', content, source, avatarUrl: MASCOT_IMAGES[1] });
                } else {
                    addMessage({
                        id: Date.now(),
                        type: 'bot',
                        content: (
                            <div>
                                <p>죄송합니다. 관련 정보를 찾지 못했어요. 😥</p>
                                <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                                    정확한 배출 방법은 관할 구청에 문의해보시는 게 가장 정확해요.
                                </p>
                                <a
                                    href="tel:120"
                                    style={{
                                        display: 'inline-block',
                                        marginTop: '1rem',
                                        padding: '0.6rem 1rem',
                                        backgroundColor: '#f1f3f5',
                                        color: '#333',
                                        borderRadius: '8px',
                                        textDecoration: 'none',
                                        fontWeight: '600',
                                        fontSize: '0.9rem',
                                        border: '1px solid #dee2e6'
                                    }}
                                >
                                    📞 다산콜센터(120)에 문의하기
                                </a>
                            </div>
                        ),
                        avatarUrl: '/images/eco_mascot_no.png'
                    });
                }
            } else {
                addMessage({
                    id: Date.now(),
                    type: 'bot',
                    content: (
                        <div>
                            <p>정보를 불러오는데 실패했습니다.</p>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    marginTop: '0.5rem',
                                    padding: '0.4rem 0.8rem',
                                    backgroundColor: '#FF5252',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                🔄 다시 시도하기
                            </button>
                        </div>
                    ),
                    avatarUrl: '/images/eco_mascot_no.png'
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

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;

            // Display user message with image immediately
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
                        <span>📷 사진을 분석중입니다...</span>
                    </div>
                )
            });

            // Extract mimetype
            const matches = base64.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                fetchRecycleInfo("image", base64Data, mimeType);
            }
        };
        reader.readAsDataURL(file);

        // Reset input
        e.target.value = '';
    };

    // ... (useEffect for searchParams, handleSubmit, sendMessage logic same as before)
    // Check for pending image from Home page
    useEffect(() => {
        const pendingImage = sessionStorage.getItem('pendingImage');
        if (pendingImage) {
            // Display immediately
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
                        <span>📷 사진을 분석중입니다...</span>
                    </div>
                )
            });

            // Process
            const matches = pendingImage.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                fetchRecycleInfo("image", base64Data, mimeType);
            }

            // Clear
            sessionStorage.removeItem('pendingImage');
        }
    }, []);

    useEffect(() => {
        const query = searchParams.get('q');
        const mode = searchParams.get('mode');

        if (query && query !== lastHandledQuery.current) {
            lastHandledQuery.current = query;
            addMessage({ id: Date.now(), type: 'user', content: query });
            fetchRecycleInfo(query);
        } else if (mode === 'voice') {
            // Auto-start voice if requested
            // Small timeout to allow render
            setTimeout(() => {
                handleVoiceInput();
            }, 500);
        }
    }, [searchParams]);

    const [chatPlaceholder, setChatPlaceholder] = useState('예: 매트리스, 형광등, 커피찌꺼기');

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

    const sendMessage = (text: string) => {
        addMessage({ id: Date.now(), type: 'user', content: text });
        setInput('');
        fetchRecycleInfo(text);
    };

    const handleFeedback = (type: 'positive' | 'negative') => {
        if (type === 'positive') {
            alert("도움이 되었다니 다행이에요! 😊\n더 궁금한 점이 있으시면 언제든 물어봐주세요.");
        } else {
            alert("부족한 점을 보완하여 더 똑똑한 에코도우미가 될게요! 😢\n정확한 정보는 관할 구청에 다시 한 번 확인 부탁드려요.");
        }
    };

    return (
        <div className={styles.container}>
            <input
                type="file"
                accept="image/*"
                capture="environment" // Mobile camera trigger
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleImageUpload}
            />

            <div className={styles.messagesArea}>
                {/* ... (Message Rendering same as before) ... */}
                {messages.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.mascotContainer}>
                            <img src={welcomeMascot} alt="Welcome" className={styles.mascotImage} />
                        </div>
                        <h2 className={styles.welcomeText}>무엇이든 물어봐주세요!</h2>

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
                                        <div className={styles.feedbackContainer}>
                                            <button className={styles.feedbackBtn} onClick={() => handleFeedback('positive')}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                                                도움됨
                                            </button>
                                            <button className={styles.feedbackBtn} onClick={() => handleFeedback('negative')}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2H20a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>
                                                아쉬움
                                            </button>
                                        </div>
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
                {/* Attach Menu Popover */}
                <div className={`${styles.attachMenu} ${showAttachMenu ? styles.show : ''}`}>
                    <button type="button" className={styles.attachBtn} onClick={handleCameraClick}>
                        <div className={styles.attachIconCircle}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                        </div>
                        <span>사진</span>
                    </button>
                    <button type="button" className={styles.attachBtn} onClick={handleVoiceInput}>
                        <div className={styles.attachIconCircle}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                        </div>
                        <span>음성</span>
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
