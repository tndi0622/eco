import { createClient } from "@supabase/supabase-js"
import { JWT } from "google-auth-library"

// @ts-ignore: Deno namespace is available in Supabase Edge Functions
Deno.serve(async (req: Request) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    try {
        // 1. 한국 시간(KST) 및 요일 확인
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Seoul",
            hour12: false,
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit"
        });

        const parts = formatter.formatToParts(now);
        const getPart = (type: string) => parts.find(p => p.type === type)?.value;

        const kstDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const currentDay = kstDate.getDay();
        const currentTime = `${getPart('hour')}:${getPart('minute')}`;

        console.log(`알림 체크 시작: 요일 ${currentDay}, 시간 ${currentTime}`);

        const { data: users, error: userError } = await supabase
            .from('profiles')
            .select('id, fcm_token, notification_settings')
            .not('fcm_token', 'is', null);

        if (userError || !users || users.length === 0) {
            console.log("알림 대상 사용자 없음 혹은 에러:", userError);
            return new Response(JSON.stringify({ message: "No users to notify" }), { status: 200 });
        }

        const notifications = [];

        for (const user of users) {
            const s = user.notification_settings as any;
            if (!s) continue;

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
    } catch (err: any) { // err 타입을 any로 명시하여 'unknown' 에러 해결
        console.error("함수 실행 중 전체 오류:", err);
        return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
    }
})

async function sendFCM(fcmToken: string, title: string, body: string): Promise<any> {
    try {
        const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
        const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')
            ?.replace(/\\n/g, '\n')
            .replace(/^"(.*)"$/, '$1');

        const projectId = Deno.env.get('FIREBASE_PROJECT_ID');

        if (!clientEmail || !privateKey || !projectId) {
            throw new Error("Missing Firebase configuration in environment variables");
        }

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
                        notification: { click_action: "FLUTTER_NOTIFICATION_CLICK" }
                    },
                    apns: {
                        payload: { aps: { sound: "default" } }
                    }
                }
            })
        });

        return await response.json();
    } catch (err: any) { // err 타입을 any로 명시하여 'unknown' 에러 해결
        console.error("FCM 전송 오류:", err);
        return { error: err.message || String(err) };
    }
}
