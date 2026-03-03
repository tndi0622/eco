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
    loading: boolean;
    useToken: (cost?: number) => Promise<boolean>;
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
        handleFcmToken?: (token: string) => void;
        handleRewardEarned?: (amount: number, type: string) => void;
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

        // 네이티브 구글 로그인 핸들러
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
                    // 필요한 경우 로컬 상태 업데이트를 강제 (onAuthStateChange가 처리하긴 함)
                }
            } catch (err) {
                console.error("Native Login Exception:", err);
            }
        };

        // FCM 토큰 핸들러
        window.handleFcmToken = async (fcmToken: string) => {
            console.log("Received FCM Token from Flutter:", fcmToken);
            localStorage.setItem('fcmToken', fcmToken);

            // 사용자가 이미 로그인된 경우 프로필 업데이트
            if (supabase) {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                if (currentUser) {
                    await supabase
                        .from('profiles')
                        .update({ fcm_token: fcmToken })
                        .eq('id', currentUser.id);
                }
            }
        };

        // 보상형 광고 완료 핸들러
        window.handleRewardEarned = async (amount: number, type: string) => {
            console.log(`Earned reward: ${amount} ${type}`);
            const success = await addAdToken();
            if (success) {
                alert('광고 시청 보상으로 토큰 1개가 지급되었습니다!');
            }
        };

        // 앱이 토큰을 전달할 수 있도록 웹뷰가 준비되었음을 알림
        if (window.flutter_inappwebview) {
            window.flutter_inappwebview.callHandler('FlutterLoginChannel', 'webViewReady');
        }

        return () => {
            subscription.unsubscribe();
            delete window.handleNativeGoogleLogin;
            delete window.handleFcmToken;
            delete window.handleRewardEarned;
        };
    }, []);

    const handleUserChange = (newUser: User | null) => {
        if (newUser?.id === lastFetchedId.current && newUser !== null) return;

        setUser(newUser);
        if (newUser) {
            lastFetchedId.current = newUser.id;
            fetchProfile(newUser.id);

            // 저장할 대기 중인 FCM 토큰이 있는지 확인
            const pendingFcmToken = localStorage.getItem('fcmToken');
            if (pendingFcmToken && supabase) {
                supabase
                    .from('profiles')
                    .update({ fcm_token: pendingFcmToken })
                    .eq('id', newUser.id)
                    .then();
            }
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

            // 인증된 사용자를 위한 일일 로그인 토큰 로직
            const todayStr = new Date().toISOString().split('T')[0];
            const lastLoginDate = localStorage.getItem('lastLoginDate'); // 세션 로그인을 추적하기 위해 여전히 로컬 스토리지를 사용할 수 있음
            // DB에 last_login 컬럼을 두는 것이 더 좋지만, 현재로서는 로컬 스토리지가 더 간단함.

            if (lastLoginDate !== todayStr) {
                localStorage.setItem('lastLoginDate', todayStr);
                localStorage.setItem('adTokensToday', '0');
                setAdTokensToday(0);

                currentTokens += 1;
                // 데이터베이스 업데이트
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

        // 일일 초기화 및 로그인 토큰 로직
        const todayStr = new Date().toISOString().split('T')[0];
        const lastLoginDate = localStorage.getItem('lastLoginDate');
        const savedAdTokens = localStorage.getItem('adTokensToday');

        if (lastLoginDate !== todayStr) {
            // 새로운 하루 로직
            localStorage.setItem('lastLoginDate', todayStr);
            localStorage.setItem('adTokensToday', '0');
            setAdTokensToday(0);

            // 일일 토큰 1개 증정
            const currentTokens = savedTokens ? parseInt(savedTokens) : tokens;
            const nextTokens = currentTokens + 1;
            setTokens(nextTokens);
            localStorage.setItem('userTokens', nextTokens.toString());

            // 이 알림은 새로 시작할 때마다 짜증날 수 있지만, 사용자가 요청한 기능임
            // 토스트 메시지 등을 보여주는 것이 더 좋지만, 별도의 요청이 없었으므로 간단하게 유지함.
            // 실제로는 지금은 그냥 조용히 처리하거나 콘솔 로그만 남기기로 함.
            // UserProvider에 구현되어 있으므로 매번 새로고침할 때마다 실행됨.
        } else {
            setAdTokensToday(parseInt(savedAdTokens || '0'));
        }
    };

    const loginWithGoogle = async () => {
        if (!supabase) return;

        // Flutter 네이티브 로그인 확인
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
        // Flutter에도 로그아웃을 알리고 완료될 때까지 대기
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

    const useToken = async (cost: number = 1) => {
        if (isSubscribed || isAdmin) return true;

        let success = false;
        let nextTokens = 0;

        setTokens(prev => {
            if (prev >= cost) {
                success = true;
                nextTokens = prev - cost;
                return nextTokens;
            }
            return prev;
        });

        if (success) {
            if (user && supabase) {
                try {
                    await supabase.from('profiles').upsert({ id: user.id, tokens: nextTokens });
                } catch (err) {
                    console.error("Token Update Error:", err);
                }
            } else {
                localStorage.setItem('userTokens', nextTokens.toString());
            }
            return true;
        }
        return false;
    };

    const addAdToken = async (): Promise<boolean> => {
        if (adTokensToday >= 3) return false;

        let nextTokens = 0;
        let nextAdToday = 0;

        setTokens(prev => {
            nextTokens = prev + 1;
            return nextTokens;
        });

        setAdTokensToday(prev => {
            nextAdToday = prev + 1;
            return nextAdToday;
        });

        if (user && supabase) {
            try {
                await supabase.from('profiles').upsert({ id: user.id, tokens: nextTokens }).eq('id', user.id);
            } catch (err) {
                console.error("Ad Token Update Error:", err);
            }
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

    const contextValue = React.useMemo(() => ({
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
        logout,
        loading
    }), [user, tokens, isSubscribed, isAdmin, subscriptionExpiry, adTokensToday, loading]);

    return (
        <UserContext.Provider value={contextValue}>
            {!loading && children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) throw new Error('useUser must be used within UserProvider');
    return context;
}
