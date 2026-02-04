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
    const [messages, setMessages] = useState<Message[]>([]);

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
