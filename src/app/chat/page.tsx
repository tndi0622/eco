'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import { useChat, Message } from '@/context/ChatContext';
import { useLocation } from '@/context/LocationContext';

export default function Chat() {
    const searchParams = useSearchParams();
    const lastHandledQuery = useRef<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { location } = useLocation();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Use global state instead of local state
    const { messages, addMessage } = useChat();
    const [input, setInput] = useState('');

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const MASCOT_IMAGES = [
        '/images/eco_mascot_icon.png',
        '/images/eco_mascot_thinking.png',
        '/images/eco_mascot_idea.png',
        '/images/eco_mascot_finish.png',
    ];

    const getJosa = (word: string, josa: '은/는' | '이/가' | '을/를') => {
        if (!word) return '';

        // Find the last Hangul character in the string
        // This handles cases like "택배 박스 (스티로폼)" -> checks '폼'
        let lastCharIndex = word.length - 1;
        while (lastCharIndex >= 0) {
            const code = word.charCodeAt(lastCharIndex);
            // Check if it's a Hangul Syllable (AC00-D7A3)
            if (code >= 0xAC00 && code <= 0xD7A3) {
                break;
            }
            lastCharIndex--;
        }

        if (lastCharIndex < 0) return josa; // No Hangul found, return original

        const lastCharCode = word.charCodeAt(lastCharIndex);
        const hasBatchim = (lastCharCode - 0xAC00) % 28 > 0;

        if (josa === '은/는') return hasBatchim ? '은' : '는';
        if (josa === '이/가') return hasBatchim ? '이' : '가';
        if (josa === '을/를') return hasBatchim ? '을' : '를';
        return josa;
    };

    const extractKeyword = (text: string) => {
        let cleanText = text.replace(/[?.!,]/g, '').trim();
        let modifier: string | null = null; // 'dirty', 'broken', 'liquid'

        // Detect context modifiers
        if (cleanText.includes('묻은') || cleanText.includes('더러운') || cleanText.includes('음식물') || cleanText.includes('이물질')) {
            modifier = 'dirty';
        } else if (cleanText.includes('깨진') || cleanText.includes('파손된')) {
            modifier = 'broken';
        } else if (cleanText.includes('액체') || cleanText.includes('남은') || cleanText.includes('내용물')) {
            modifier = 'liquid';
        } else if (cleanText.includes('기름')) {
            modifier = 'oil';
        }

        // 1. Common ending phrases to remove (Longest first)
        const removePhrases = [
            '어떻게 버려요', '어떻게 버리나요', '어떻게 버려', '어떻게 처리해요',
            '버리는 법', '버리는 방법', '버리는법', '배출 방법', '배출법',
            '알려줘', '알려주세요', '어떻게', '버려요', '버려', '요',
            '처리', '수거', '폐기'
        ];

        for (const phrase of removePhrases) {
            if (cleanText.endsWith(phrase)) {
                cleanText = cleanText.substring(0, cleanText.length - phrase.length).trim();
            }
        }

        // 2. Remove particles from each word
        const words = cleanText.split(' ').filter(w => w);
        const processedWords = words.map(word => {
            const particles = ['을', '를', '은', '는', '이', '가', '도', '로', '으로', '에'];
            for (const p of particles) {
                if (word.endsWith(p) && word.length > p.length) {
                    return word.slice(0, -p.length);
                }
            }
            return word;
        });

        // Join remaining words. 
        // Example: "피자 박스" -> "피자 박스"
        return { keyword: processedWords.join(' '), modifier };
    };

    const fetchRecycleInfo = async (originalQuery: string) => {
        const { keyword, modifier } = extractKeyword(originalQuery);
        console.log(`Searching for keyword: ${keyword} (Modifier: ${modifier})`);

        try {
            // Include location in the query if available
            const locationParam = location && location !== '위치 설정이 필요합니다' && location !== '위치 파악 실패'
                ? `&loc=${encodeURIComponent(location)}`
                : '';

            const res = await fetch(`/api/recycle?q=${encodeURIComponent(keyword)}${locationParam}`);
            const data = await res.json();

            let content: React.ReactNode = '검색 결과가 없습니다.';
            let source = '에코 봇';

            // 1. Handle Gemini Response
            if (data.resultType === 'gemini') {
                content = (
                    <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                        {data.message}
                    </div>
                );

                const botResponse: Message = {
                    id: Date.now() + Math.random(),
                    type: 'bot',
                    content: content,
                    source: source, // defaults to '에코 봇'
                    avatarUrl: '/images/eco_mascot_idea.png' // Use a thinking/idea mascot for AI
                };
                addMessage(botResponse);
            }
            // 2. Handle Legacy List Response (Fallback)
            else if (data.response && data.response.body) {
                source = '기후에너지환경부';
                // Determine items based on structure
                const rawItems = data.response.body.items;
                let realItems: any[] = [];

                if (rawItems) {
                    if (Array.isArray(rawItems)) {
                        realItems = rawItems;
                    } else if (Array.isArray(rawItems.item)) {
                        realItems = rawItems.item;
                    } else if (rawItems.item) {
                        realItems = [rawItems.item];
                    } else if (typeof rawItems === 'object' && Object.keys(rawItems).length > 0) {
                        // Sometimes it's just the object itself
                    }
                }

                // Also check totalCount if available
                if (data.response.body.totalCount === 0 || !rawItems) {
                    realItems = [];
                }

                if (realItems.length > 0) {

                    const intro = ["제가 찾아봤어요! 🧐", "관련된 정보를 찾았어요! 🌱", "이렇게 배출하면 돼요! 💡"];
                    const randomIntro = intro[Math.floor(Math.random() * intro.length)];

                    content = (
                        <div>
                            {modifier && (
                                <div style={{
                                    backgroundColor: '#FFF3E0',
                                    padding: '0.8rem',
                                    borderRadius: '8px',
                                    marginBottom: '1rem',
                                    fontSize: '0.95rem',
                                    borderLeft: '4px solid #FF9800'
                                }}>
                                    {modifier === 'dirty' && (
                                        <p>🚿 <strong>이물질이 묻었다면?</strong><br />내용물을 비우고 깨끗이 씻어서 배출해주세요. 만약 씻기지 않는다면 <strong>일반쓰레기</strong>로 버려야 합니다.</p>
                                    )}
                                    {modifier === 'broken' && (
                                        <p>🩹 <strong>깨졌다면?</strong><br />재활용이 불가능해요. 신문지에 싸서 <strong>일반쓰레기(종량제봉투)</strong>나 특수규격봉투(불연성)로 배출해주세요.</p>
                                    )}
                                    {modifier === 'liquid' && (
                                        <p>💧 <strong>내용물이 남았다면?</strong><br />액체나 내용물은 모두 비우고 헹군 뒤에 배출해야 재활용이 가능합니다!</p>
                                    )}
                                    {modifier === 'oil' && (
                                        <p>🛢️ <strong>기름이 묻었다면?</strong><br />기름기는 물로 잘 씻기지 않아요. 세제로 깨끗이 닦이지 않는다면 <strong>일반쓰레기</strong>로 버려주세요.</p>
                                    )}
                                </div>
                            )}
                            <p style={{ marginBottom: '1rem', fontWeight: 600 }}>{randomIntro}</p>
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {realItems.map((item: any, idx: number) => {
                                    const name = item.itemNm || item.prdctNm || '품목'; // fallback
                                    const method = item.dschgMthd || item.contents || '배출 방법 정보가 없습니다.';
                                    return (
                                        <li key={idx} style={{ marginBottom: '1rem', lineHeight: '1.5' }}>
                                            <span style={{ color: '#27AE60', fontWeight: 'bold' }}>{name}</span>
                                            {getJosa(name, '은/는')} <br />
                                            <strong>{method}</strong>(으)로 배출해주세요.
                                        </li>
                                    );
                                })}
                            </ul>
                            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#888' }}>
                                지구를 지키는 당신, 정말 멋져요! 🌍
                            </p>
                        </div>
                    );

                    const randomImage = MASCOT_IMAGES[Math.floor(Math.random() * MASCOT_IMAGES.length)];
                    const botResponse: Message = {
                        id: Date.now() + Math.random(),
                        type: 'bot',
                        content: content,
                        source: source,
                        avatarUrl: randomImage
                    };
                    addMessage(botResponse);

                } else {
                    // Result not found
                    const botResponse: Message = {
                        id: Date.now() + Math.random(),
                        type: 'bot',
                        content: (
                            <div>
                                <p>관련 정보를 찾지 못했어요 😢</p>
                                <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                                    다른 단어로 검색해 보시겠어요?<br />
                                    (예: '피자 박스' 대신 '피자' 또는 '종이')
                                </p>
                            </div>
                        ),
                        avatarUrl: '/images/eco_mascot_no.png'
                    };
                    addMessage(botResponse);
                }
            } else { // This else block handles cases where data.response or data.response.body is missing, or if data.data exists as a fallback.
                // No valid response structure
                const botResponse: Message = {
                    id: Date.now() + Math.random(),
                    type: 'bot',
                    content: (
                        <div>
                            <p>정보를 불러오는데 문제가 생겼어요 💦</p>
                            <p style={{ fontSize: '0.9rem', color: '#666' }}>잠시 후 다시 시도해주세요.</p>
                        </div>
                    ),
                    avatarUrl: '/images/eco_mascot_no.png'
                };
                addMessage(botResponse);
            }

        } catch (error) {
            console.error("Chat Error", error);
            const botResponse: Message = {
                id: Date.now() + Math.random(),
                type: 'bot',
                content: '정보를 불러오는데 실패했습니다.',
                avatarUrl: '/images/eco_mascot_no.png'
            };
            addMessage(botResponse);
        }
    };

    useEffect(() => {
        const query = searchParams.get('q');
        if (query && query !== lastHandledQuery.current) {
            lastHandledQuery.current = query;

            const newMessage: Message = {
                id: Date.now() + Math.random(),
                type: 'user',
                content: query
            };
            addMessage(newMessage);

            // Fetch info
            fetchRecycleInfo(query);
        }
    }, [searchParams, addMessage]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        sendMessage(input);
    };

    const sendMessage = (text: string) => {
        // Add user message
        const newMessage: Message = {
            id: Date.now() + Math.random(),
            type: 'user',
            content: text
        };

        addMessage(newMessage);
        setInput('');

        // Fetch info
        fetchRecycleInfo(text);
    };

    const SUGGESTIONS = [
        '🍕 피자 박스 버리는 법',
        '🧴 샴푸 통은 어떻게?',
        '🔋 폐건전지 수거',
        '❄️ 아이스팩 처리'
    ];

    return (
        <div className={styles.container}>
            <div className={styles.messagesArea}>
                {messages.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.mascotContainer}>
                            <img src="/images/eco_mascot_welcome.png" alt="Welcome" className={styles.mascotImage} />
                        </div>
                        <h2 className={styles.welcomeText}>무엇이든 물어봐주세요!</h2>
                        <p className={styles.subText}>재활용, 분리수거 방법을 알려드려요 🌱</p>

                        <div className={styles.suggestions}>
                            {SUGGESTIONS.map((s, i) => (
                                <button key={i} className={styles.chip} onClick={() => sendMessage(s)}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`${styles.messageWrapper} ${msg.type === 'user' ? styles.userWrapper : styles.botWrapper}`}
                        >
                            <div className={`${styles.bubble} ${msg.type === 'user' ? styles.userBubble : styles.botBubble}`}>
                                {msg.type === 'bot' && (
                                    <div className={styles.botHeader}>
                                        {msg.avatarUrl ? (
                                            <img src={msg.avatarUrl} alt="Mascot" className={styles.botAvatar} />
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M9 21C9 21.55 9.45 22 10 22H14C14.55 22 15 21.55 15 21V20H9V21ZM12 2C8.14 2 5 5.14 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.14 15.86 2 12 2Z" fill="#27AE60" />
                                            </svg>
                                        )}
                                        [분리배출 팁]
                                    </div>
                                )}
                                <div>{msg.content}</div>
                                {msg.source && <p className={styles.source}>출처 : {msg.source}</p>}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className={styles.inputArea}>
                <form className={styles.inputWrapper} onSubmit={handleSubmit}>
                    <div className={styles.micIcon}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14ZM11 5C11 4.45 11.45 4 12 4C12.55 4 13 4.45 13 5V11C13 11.55 12.55 12 12 12C11.45 12 11 11.55 11 11V5ZM19 11C19 14.87 15.87 18 12 18C8.13 18 5 14.87 5 11H3C3 15.53 6.39 19.36 10.74 19.91V23H13.26V19.91C17.61 19.36 21 15.53 21 11H19Z" fill="currentColor" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="메세지를 입력하세요.."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />
                    <button type="submit" style={{ display: 'none' }}>Send</button>
                </form>
            </div>
        </div>
    );
}
