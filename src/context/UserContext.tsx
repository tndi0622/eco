'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface UserContextType {
    user: User | null;
    tokens: number;
    isSubscribed: boolean;
    isAdmin: boolean;
    subscriptionExpiry: string | null;
    adTokensToday: number;
    useToken: (cost?: number) => boolean;
    addAdToken: () => Promise<boolean>;
    purchaseTokens: (count: number) => Promise<void>;
    subscribe: () => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [tokens, setTokens] = useState<number>(1);
    const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(null);
    const [adTokensToday, setAdTokensToday] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const lastFetchedId = useRef<string | null>(null);

    useEffect(() => {
        if (!supabase) {
            loadLocalData();
            setLoading(false);
            return;
        }

        // onAuthStateChange handles both initial session and subsequent changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            handleUserChange(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleUserChange = (newUser: User | null) => {
        // Only fetch if user actually changed or was previously null
        if (newUser?.id === lastFetchedId.current && newUser !== null) return;

        setUser(newUser);
        if (newUser) {
            lastFetchedId.current = newUser.id;
            fetchProfile(newUser.id);
        } else {
            lastFetchedId.current = null;
            loadLocalData();
            setIsAdmin(false);
            setIsSubscribed(false);
        }
    };

    const fetchProfile = async (userId: string) => {
        if (!supabase) return;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error("Profile Fetch Error:", error.message);
            return;
        }

        if (data) {
            setTokens(data.tokens);
            // 관리자 여부 및 구독 상태 업데이트
            const isManager = data.is_admin === true;
            setIsAdmin(isManager);
            setIsSubscribed(isManager || data.is_subscribed === true);
            setSubscriptionExpiry(data.subscription_expiry);
        }
    };

    const loadLocalData = () => {
        const savedTokens = localStorage.getItem('userTokens');
        if (savedTokens) setTokens(parseInt(savedTokens));
        setAdTokensToday(parseInt(localStorage.getItem('adTokensToday') || '0'));
    };

    const loginWithGoogle = async () => {
        if (!supabase) return;

        // 현재 사이트가 로컬인지 실서버인지에 따라 리다이렉트 URL 결정
        const origin = window.location.origin;

        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${origin}/settings`,
                queryParams: {
                    prompt: 'select_account'
                }
            },
        });
    };

    const logout = async () => {
        if (supabase) await supabase.auth.signOut();
        setUser(null);
        setTokens(1);
        setIsSubscribed(false);
        setIsAdmin(false);
        // Do not clear everything, only user-specific persistent data
        localStorage.removeItem('userTokens');
        localStorage.removeItem('adTokensToday');
        localStorage.removeItem('userCoordinates');
        // Keep favorites if you want them to persist locally, or clear if they are strictly user-bound
        localStorage.removeItem('userLocation');
        window.location.reload();
    };

    const useToken = (cost: number = 1) => {
        if (isSubscribed || isAdmin) return true;
        if (tokens >= cost) {
            const nextTokens = tokens - cost;
            setTokens(nextTokens);
            if (user && supabase) {
                supabase.from('profiles').update({ tokens: nextTokens }).eq('id', user.id).then();
            } else {
                localStorage.setItem('userTokens', nextTokens.toString());
            }
            return true;
        }
        return false;
    };

    const addAdToken = async (): Promise<boolean> => {
        if (adTokensToday >= 3) return false;
        await new Promise(resolve => setTimeout(resolve, 2000));
        const nextTokens = tokens + 1;
        const nextAdToday = adTokensToday + 1;
        setTokens(nextTokens);
        setAdTokensToday(nextAdToday);

        if (user && supabase) {
            await supabase.from('profiles').update({ tokens: nextTokens }).eq('id', user.id);
        } else {
            localStorage.setItem('userTokens', nextTokens.toString());
            localStorage.setItem('adTokensToday', nextAdToday.toString());
        }
        return true;
    };

    const purchaseTokens = async (count: number) => {
        const nextTokens = tokens + count;
        setTokens(nextTokens);
        if (user && supabase) {
            await supabase.from('profiles').update({ tokens: nextTokens }).eq('id', user.id);
        } else {
            localStorage.setItem('userTokens', nextTokens.toString());
        }
    };

    const subscribe = async () => {
        setIsSubscribed(true);
        if (user && supabase) {
            await supabase.from('profiles').update({ is_subscribed: true }).eq('id', user.id);
        }
    };

    return (
        <UserContext.Provider value={{
            user,
            tokens,
            isSubscribed,
            isAdmin,
            subscriptionExpiry,
            adTokensToday,
            useToken,
            addAdToken,
            purchaseTokens,
            subscribe,
            loginWithGoogle,
            logout
        }}>
            {!loading && children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) throw new Error('useUser must be used within UserProvider');
    return context;
}
