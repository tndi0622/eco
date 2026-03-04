import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { JWT } from "https://esm.sh/google-auth-library@9"

serve(async (req: Request) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. 한국 시간(KST) 및 요일 확인
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const currentDay = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    console.log(`알림 체크 시작: 요일 ${currentDay}, 시간 ${currentTime}`);

    // 2. 알림 대상자 조회
    const { data: users, error } = await supabase
        .from('profiles')
        .select('id, fcm_token, notification_settings')
        .not('fcm_token', 'is', null);

    if (error || !users) {
        console.log("알림 대상 사요아 없음 혹은 에러:", error);
        return new Response("No users found", { status: 200 });
    }

    const notifications = [];

    for (const user of users) {
        const s = user.notification_settings as any;
        if (!s) continue;

        // 배출 품목별 체크
        const tasks = [
            { key: 'general', label: '일반 쓰레기', body: '지금은 일반 쓰레기 배출 시간입니다!' },
            { key: 'recycle', label: '재활용', body: '지금은 재활용 쓰레기 배출 시간입니다!' },
            { key: 'food', label: '음식물', body: '지금은 음식물 쓰레기 배출 시간입니다!' }
        ];

        for (const task of tasks) {
            if (s[task.key] &&
                s[`${task.key}Days`]?.includes(currentDay) &&
                s[`${task.key}Time`] === currentTime) {
                notifications.push(sendFCM(user.fcm_token, `[에코도우미] ${task.label}`, task.body));
            }
        }
    }

    const results = await Promise.all(notifications);
    console.log(`알림 발송 완료: ${results.length}건`);

    return new Response(JSON.stringify({ success: true, count: results.length, details: results }), {
        headers: { "Content-Type": "application/json" },
    })
})

async function sendFCM(fcmToken: string, title: string, body: string) {
    try {
        // 환경변수에서 서비스 계정 정보 가져오기
        const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
        const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
        const projectId = Deno.env.get('FIREBASE_PROJECT_ID');

        if (!clientEmail || !privateKey || !projectId) {
            throw new Error("Missing Firebase configuration in environment variables");
        }

        // OAuth2 토큰 생성 (FCM v1용)
        const client = new JWT({
            email: clientEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
        });

        const tokens = await client.authorize();
        const accessToken = tokens.access_token;

        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                message: {
                    token: fcmToken,
                    notification: { title, body },
                    android: {
                        priority: "high",
                        notification: {
                            click_action: "FLUTTER_NOTIFICATION_CLICK"
                        }
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: "default"
                            }
                        }
                    }
                }
            })
        });

        const result = await response.json();
        return result;
    } catch (err) {
        console.error("FCM 전송 오류:", err);
        return { error: err.message };
    }
}
