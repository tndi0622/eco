'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Message {
    id: number;
    type: 'user' | 'bot';
    content: React.ReactNode;
    source?: string;
    avatarUrl?: string;
}

interface ChatContextType {
    messages: Message[];
    addMessage: (message: Message) => void;
    updateMessage: (id: number, updates: Partial<Message> | React.ReactNode) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<Message[]>([]);

    const addMessage = (message: Message) => {
        setMessages((prev) => [...prev, message]);
    };

    const updateMessage = (id: number, updates: Partial<Message> | React.ReactNode) => {
        setMessages((prev) => prev.map(m => {
            if (m.id === id) {
                if (React.isValidElement(updates) || typeof updates === 'string') {
                    return { ...m, content: updates };
                }
                return { ...m, ...(updates as Partial<Message>) };
            }
            return m;
        }));
    };

    return (
        <ChatContext.Provider value={{ messages, addMessage, updateMessage }}>
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
