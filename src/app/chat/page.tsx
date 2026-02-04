'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import { useChat, Message } from '@/context/ChatContext';

export default function Chat() {
    const searchParams = useSearchParams();
    const lastHandledQuery = useRef<string | null>(null);

    // Use global state instead of local state
    const { messages, addMessage } = useChat();
    const [input, setInput] = useState('');

    const extractKeyword = (text: string) => {
        // Remove common punctuation and ending question words first
        const cleanText = text.replace(/[?.!,]/g, '').trim();
        const words = cleanText.split(' ').filter(w => w.trim().length > 0);

        // Scan for particles with priority (Object > Topic > Subject)
        // This handles "소파를 버리고싶은데 폐기물스티커가 필요해?" -> Picks "소파" (has '를') instead of "폐기물스티커" (has '가')

        // 1. Object markers (을/를) - Highest priority
        for (const word of words) {
            if (word.endsWith('을') && word.length > 1) return word.slice(0, -1);
            if (word.endsWith('를') && word.length > 1) return word.slice(0, -1);
        }

        // 2. Topic markers (은/는)
        for (const word of words) {
            if (word.endsWith('은') && word.length > 1) return word.slice(0, -1);
            if (word.endsWith('는') && word.length > 1) return word.slice(0, -1);
        }

        // 3. Subject markers (이/가) & others
        const otherParticles = ['이', '가', '도', '만', '로', '으로'];
        for (const word of words) {
            for (const particle of otherParticles) {
                if (word.endsWith(particle) && word.length > particle.length) {
                    return word.slice(0, -particle.length);
                }
            }
        }

        // If no particle found, take the last word, but filter out common non-nouns
        const ignoredWords = ['어떻게', '버려', '버려요', '버리나요', '방법', '배출', '알려줘', '요'];
        let lastWord = words[words.length - 1];

        if (lastWord && ignoredWords.some(iw => lastWord.includes(iw))) {
            if (words.length > 1) return words[words.length - 2];
        }

        return lastWord || text;
    };

    const fetchRecycleInfo = async (originalQuery: string) => {
        const query = extractKeyword(originalQuery);
        console.log(`Searching for keyword: ${query} (Original: ${originalQuery})`);

        try {
            const res = await fetch(`/api/recycle?q=${encodeURIComponent(query)}`);
            const data = await res.json();

            let content: React.ReactNode = '검색 결과가 없습니다.';
            let source = '기후에너지환경부';

            if (data.response && data.response.body && data.response.body.items) {
                const items = data.response.body.items.item; // items: { item: [ ... ] } or item object
                // Usually items is an object containing 'item' which can be array or object.
                // Our API route normalizes? No it returns raw JSON from xml2js mostly or just passes through if getRecycleList returns JSON. 
                // Wait, our API route returns what it gets.
                // If the third party API returned JSON, usually structure is { response: { body: { items: [ ... ] } } } or so.
                // But data.go.kr JSON often: { response: { body: { items: { item: [ ... ] } } } }

                // Let's inspect safely.
                const itemList = Array.isArray(items) ? items : (items ? [items] : []); // Check if items itself is array
                // actually items.item is common pattern.
                let realItems: any[] = [];
                if (Array.isArray(items)) {
                    realItems = items;
                } else if (items && Array.isArray(items.item)) {
                    realItems = items.item;
                } else if (items && items.item) {
                    realItems = [items.item];
                } else if (items) {
                    // Maybe items is the array? Sometimes happens.
                    realItems = [items];
                }

                if (realItems.length > 0) {

                    const intro = ["제가 찾아봤어요! 🧐", "관련된 정보를 찾았어요! 🌱", "이렇게 배출하면 돼요! 💡"];
                    const randomIntro = intro[Math.floor(Math.random() * intro.length)];

                    content = (
                        <div>
                            <p style={{ marginBottom: '1rem', fontWeight: 600 }}>{randomIntro}</p>
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {realItems.map((item: any, idx: number) => {
                                    const name = item.itemNm;
                                    const method = item.dschgMthd;
                                    return (
                                        <li key={idx} style={{ marginBottom: '1rem', lineHeight: '1.5' }}>
                                            <span style={{ color: '#27AE60', fontWeight: 'bold' }}>{name}</span>
                                            {/[은는이가]$/.test(name) ? '' : '은(는)'} <br />
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
                }
            } else if (data.data) {
                // Maybe different structure
                content = JSON.stringify(data.data);
            }

            const botResponse: Message = {
                id: Date.now() + Math.random(),
                type: 'bot',
                content: content,
                source: source
            };
            addMessage(botResponse);

        } catch (error) {
            console.error("Chat Error", error);
            const botResponse: Message = {
                id: Date.now() + Math.random(),
                type: 'bot',
                content: '정보를 불러오는데 실패했습니다.',
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

        // Add user message
        const newMessage: Message = {
            id: Date.now() + Math.random(),
            type: 'user',
            content: input
        };

        addMessage(newMessage);
        const query = input;
        setInput('');

        // Fetch info
        fetchRecycleInfo(query);
    };

    return (
        <div className={styles.container}>
            <div className={styles.messagesArea}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`${styles.messageWrapper} ${msg.type === 'user' ? styles.userWrapper : styles.botWrapper}`}
                    >
                        <div className={`${styles.bubble} ${msg.type === 'user' ? styles.userBubble : styles.botBubble}`}>
                            {msg.type === 'bot' && (
                                <div className={styles.botHeader}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9 21C9 21.55 9.45 22 10 22H14C14.55 22 15 21.55 15 21V20H9V21ZM12 2C8.14 2 5 5.14 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.14 15.86 2 12 2Z" fill="#27AE60" />
                                    </svg>
                                    [분리배출 팁]
                                </div>
                            )}
                            <div>{msg.content}</div>
                            {msg.source && <p className={styles.source}>출처 : {msg.source}</p>}
                        </div>
                    </div>
                ))}
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
