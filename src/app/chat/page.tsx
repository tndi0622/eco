'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import { useChat, Message } from '@/context/ChatContext';
import { useLocation } from '@/context/LocationContext';
import ChatSkeleton from './ChatSkeleton';

export default function Chat() {
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
    const fetchRecycleInfo = async (queryMock: string, imageBase64?: string) => {
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
                    body: JSON.stringify({ image: imageBase64, location }) // Send location too
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
                    addMessage({ id: Date.now(), type: 'bot', content: '관련 정보를 찾지 못했어요.', avatarUrl: '/images/eco_mascot_no.png' });
                }
            } else {
                addMessage({ id: Date.now(), type: 'bot', content: '정보를 불러오는데 실패했습니다.', avatarUrl: '/images/eco_mascot_no.png' });
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

        // Display user message with "Image Sent"
        addMessage({ id: Date.now(), type: 'user', content: "📷 사진을 분석중입니다..." });

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            // Remove prefix (data:image/jpeg;base64,)
            const base64Data = base64.split(',')[1];
            fetchRecycleInfo("image", base64Data);
        };
        reader.readAsDataURL(file);

        // Reset input
        e.target.value = '';
    };

    // ... (useEffect for searchParams, handleSubmit, sendMessage logic same as before)
    useEffect(() => {
        const query = searchParams.get('q');
        if (query && query !== lastHandledQuery.current) {
            lastHandledQuery.current = query;
            addMessage({ id: Date.now(), type: 'user', content: query });
            fetchRecycleInfo(query);
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

                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`${styles.messageWrapper} ${msg.type === 'user' ? styles.userWrapper : styles.botWrapper}`}>
                            <div className={`${styles.bubble} ${msg.type === 'user' ? styles.userBubble : styles.botBubble}`}>
                                {msg.type === 'bot' && (
                                    <div className={styles.botHeader}>
                                        [에코 봇]
                                        <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#666', marginLeft: '8px' }}>
                                            {msg.source || '출처: 행정안전부_생활쓰레기배출정보'}
                                        </span>
                                    </div>
                                )}
                                <div>{msg.content}</div>
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
