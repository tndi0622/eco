'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Message {
    id: number;
    type: 'user' | 'bot';
    content: React.ReactNode;
    source?: string;
}

interface ChatContextType {
    messages: Message[];
    addMessage: (message: Message) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            type: 'user',
            content: '음식물 묻은 플라스틱, 재활용 되나요?'
        },
        {
            id: 2,
            type: 'bot',
            content: '네, 이물질을 깨끗한 물로 씻은 후 버려주세요. 기름처럼 제거하기 어려운 경우는 일반쓰레기로 버려야합니다.',
            source: '행정부 분리배출 가이드라인'
        }
    ]);

    const addMessage = (message: Message) => {
        setMessages((prev) => [...prev, message]);
    };

    return (
        <ChatContext.Provider value={{ messages, addMessage }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}
