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
    unsubscribe: () => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

declare global {
    interface Window {
        flutter_inappwebview?: {
            callHandler: (handlerName: string, ...args: any[]) => Promise<any>;
        };
        FlutterLoginChannel?: {
            postMessage: (message: string) => void;
        };
        handleNativeGoogleLogin?: (idToken: string, accessToken: string) => void;
    }
}

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

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            handleUserChange(session?.user ?? null);
            setLoading(false);
        });

        // Native Google Login Handler
        window.handleNativeGoogleLogin = async (idToken: string, accessToken: string) => {
            console.log("Received native token from Flutter");
            if (!supabase) return;

            try {
                const { data, error } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    token: idToken,
                    access_token: accessToken,
                });

                if (error) {
                    console.error("Native Login Error:", error.message);
                    alert("로그인 중 오류가 발생했습니다.");
                } else if (data.user) {
                    console.log("Native Login Success:", data.user.email);
                    // Force a local state update if needed, though onAuthStateChange should handle it
                }
            } catch (err) {
                console.error("Native Login Exception:", err);
            }
        };

        // Signal that the webview is ready for the app to pass tokens
        if (window.flutter_inappwebview) {
            window.flutter_inappwebview.callHandler('FlutterLoginChannel', 'webViewReady');
        }

        return () => {
            subscription.unsubscribe();
            delete window.handleNativeGoogleLogin;
        };
    }, []);

    const handleUserChange = (newUser: User | null) => {
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
            let currentTokens = data.tokens;
            const isManager = data.is_admin === true;
            setIsAdmin(isManager);
            setIsSubscribed(isManager || data.is_subscribed === true);
            setSubscriptionExpiry(data.subscription_expiry);

            // Daily login token logic for authenticated users
            const todayStr = new Date().toISOString().split('T')[0];
            const lastLoginDate = localStorage.getItem('lastLoginDate'); // We can still use local storage to track the *session* login
            // Or better, we could have a last_login column in DB, but for now local storage is easier.

            if (lastLoginDate !== todayStr) {
                localStorage.setItem('lastLoginDate', todayStr);
                localStorage.setItem('adTokensToday', '0');
                setAdTokensToday(0);

                currentTokens += 1;
                // Update DB
                supabase.from('profiles').upsert({ id: userId, tokens: currentTokens }).then();
            } else {
                setAdTokensToday(parseInt(localStorage.getItem('adTokensToday') || '0'));
            }

            setTokens(currentTokens);
        }
    };

    const loadLocalData = () => {
        const savedTokens = localStorage.getItem('userTokens');
        if (savedTokens) setTokens(parseInt(savedTokens));

        // Daily reset and login token logic
        const todayStr = new Date().toISOString().split('T')[0];
        const lastLoginDate = localStorage.getItem('lastLoginDate');
        const savedAdTokens = localStorage.getItem('adTokensToday');

        if (lastLoginDate !== todayStr) {
            // New Day logic
            localStorage.setItem('lastLoginDate', todayStr);
            localStorage.setItem('adTokensToday', '0');
            setAdTokensToday(0);

            // Give 1 daily token
            const currentTokens = savedTokens ? parseInt(savedTokens) : tokens;
            const nextTokens = currentTokens + 1;
            setTokens(nextTokens);
            localStorage.setItem('userTokens', nextTokens.toString());

            // This alert might be annoying on every fresh start, but user requested it as a feature
            // Better to show a toast or something, but let's keep it simple for now if they didn't specify.
            // Actually, let's just do it silently or with a console log for now, or even better, 
            // since I'm implementing it in UserProvider, it will run on every refresh.
        } else {
            setAdTokensToday(parseInt(savedAdTokens || '0'));
        }
    };

    const loginWithGoogle = async () => {
        if (!supabase) return;

        // Flutter Native Login check
        if (window.flutter_inappwebview) {
            window.flutter_inappwebview.callHandler('FlutterLoginChannel', 'googleLogin');
            return;
        }

        if (window.FlutterLoginChannel) {
            window.FlutterLoginChannel.postMessage('googleLogin');
            return;
        }

        const origin = window.location.origin;
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${origin}/`,
                queryParams: {
                    prompt: 'select_account'
                }
            },
        });
    };

    const logout = async () => {
        // Notify Flutter to logout as well and wait for completion
        if (window.flutter_inappwebview) {
            try {
                await window.flutter_inappwebview.callHandler('FlutterLoginChannel', 'logout');
            } catch (e) {
                console.error("Native logout error:", e);
            }
        } else if (window.FlutterLoginChannel) {
            window.FlutterLoginChannel.postMessage('logout');
        }

        if (supabase) await supabase.auth.signOut();
        setUser(null);
        setTokens(1);
        setIsSubscribed(false);
        setIsAdmin(false);
        localStorage.removeItem('userTokens');
        localStorage.removeItem('adTokensToday');
        localStorage.removeItem('userCoordinates');
        localStorage.removeItem('userLocation');
        window.location.href = '/';
    };

    const useToken = (cost: number = 1) => {
        if (isSubscribed || isAdmin) return true;
        if (tokens >= cost) {
            const nextTokens = tokens - cost;
            setTokens(nextTokens);
            if (user && supabase) {
                supabase.from('profiles').upsert({ id: user.id, tokens: nextTokens }).then();
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
            await supabase.from('profiles').upsert({ id: user.id, tokens: nextTokens }).eq('id', user.id);
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
            await supabase.from('profiles').upsert({ id: user.id, tokens: nextTokens });
        } else {
            localStorage.setItem('userTokens', nextTokens.toString());
        }
    };

    const subscribe = async () => {
        setIsSubscribed(true);
        if (user && supabase) {
            await supabase.from('profiles').upsert({ id: user.id, is_subscribed: true });
        }
    };

    const unsubscribe = async () => {
        setIsSubscribed(false);
        if (user && supabase) {
            await supabase.from('profiles').upsert({ id: user.id, is_subscribed: false });
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
            unsubscribe,
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
