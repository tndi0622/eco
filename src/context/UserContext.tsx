'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface UserContextType {
    user: User | null;
    tokens: number;
    isSubscribed: boolean;
    isAdmin: boolean;
    subscriptionExpiry: string | null;
    adTokensToday: number;
    useToken: () => boolean;
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

    useEffect(() => {
        if (!supabase) {
            loadLocalData();
            setLoading(false);
            return;
        }

        const initAuth = async () => {
            const { data: { session } } = await supabase!.auth.getSession();
            handleUserChange(session?.user ?? null);
            setLoading(false);
        };

        initAuth();

        const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
            handleUserChange(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleUserChange = (newUser: User | null) => {
        setUser(newUser);
        if (newUser) {
            fetchProfile(newUser.id);
        } else {
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
            console.log("Fetched User Profile:", data); // 디버깅용 로그
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
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/settings' },
        });
    };

    const logout = async () => {
        if (supabase) await supabase.auth.signOut();
        setUser(null);
        setTokens(1);
        setIsSubscribed(false);
        setIsAdmin(false);
        localStorage.clear();
        window.location.reload();
    };

    const useToken = () => {
        if (isSubscribed || isAdmin) return true;
        if (tokens > 0) {
            const nextTokens = tokens - 1;
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
