import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import wasteRules from '@/data/waste_rules.json';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const location = searchParams.get('loc');

    if (!query) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = process.env.DATA_GO_KR_API_KEY;
    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;
    // Using the recently provided key. 
    // Usually Standard Data (Living Waste) might use the Generic Decoding Key, but let's try this or fallback gracefully.
    const serviceApiKey = 'c7c9950c1f91a266a3e39644a7febeac35730f42a49c79b07e676d84e4d1bbe1';

    // 1. Data Containers
    let publicDataItems: any[] = [];      // Classification/Recycling Method
    let collectionPointItems: any[] = []; // Recovery Centers
    let wasteInfoItems: any[] = [];       // Living Waste Discharge Rules (Time/Place)

    // Helper: Parse Location
    const parseLocation = (loc: string | null) => {
        if (!loc || loc.includes('위치')) return { sido: '', sigungu: '', dong: '' };
        const parts = loc.split(' ');
        return {
            sido: parts[0] || '',
            sigungu: parts[1] || '',
            dong: parts[2] || ''
        };
    };

    const { sido, sigungu, dong } = parseLocation(location);




    // Helper: Timeout Wrapper
    const fetchWithTimeout = async (url: string, ms: number = 2500) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ms);
        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`Status ${res.status}`);
            return await res.json();
        } catch (e) {
            clearTimeout(timeoutId);
            throw e;
        }
    };

    // Parallel Fetching
    const fetchPublicData = async () => {
        if (!apiKey) return [];
        try {
            let apiUrl = `https://apis.data.go.kr/1482000/WasteRecyclingService/getRecycleList?serviceKey=${apiKey}&pageNo=1&numOfRows=10&itmNm=${encodeURIComponent(query)}&type=json`;
            let data = await fetchWithTimeout(apiUrl);

            // Retry without spaces if empty
            if (isDataEmpty(data) && query.includes(' ')) {
                const noSpaceQuery = query.replace(/\s+/g, '');
                apiUrl = `https://apis.data.go.kr/1482000/WasteRecyclingService/getRecycleList?serviceKey=${apiKey}&pageNo=1&numOfRows=10&itmNm=${encodeURIComponent(noSpaceQuery)}&type=json`;
                data = await fetchWithTimeout(apiUrl);
            }

            if (!isDataEmpty(data)) {
                const rawItems = data.response.body.items;
                if (Array.isArray(rawItems)) return rawItems;
                else if (Array.isArray(rawItems?.item)) return rawItems.item;
                else if (rawItems?.item) return [rawItems.item];
            }
            return [];
        } catch (e) {
            // console.error("Public API Failed/Timeout");
            return [];
        }
    };

    const fetchCollectionData = async () => {
        if (!serviceApiKey || !sido) return [];
        try {
            const collectionUrl = `https://apis.data.go.kr/B552584/kecoapi/reutilCltRtrvlBzentyService/getReutilCltRtrvlBzentyInfo?serviceKey=${serviceApiKey}&numOfRows=5&pageNo=1&returnType=json&sido=${encodeURIComponent(sido)}&gunGu=${encodeURIComponent(sigungu)}`;
            const cData = await fetchWithTimeout(collectionUrl);
            const rawCItems = cData.response?.body?.items;
            if (rawCItems) {
                if (Array.isArray(rawCItems)) return rawCItems;
                else if (rawCItems.item) return Array.isArray(rawCItems.item) ? rawCItems.item : [rawCItems.item];
            }
            return [];
        } catch (e) {
            return [];
        }
    };

    const isDataEmpty = (d: any) => {
        if (!d?.response?.body?.items) return true;
        const items = d.response.body.items;
        if (Array.isArray(items) && items.length === 0) return true;
        if (typeof items === 'string' && items === '') return true;
        if (items?.item && Array.isArray(items.item) && items.item.length === 0) return true;
        return false;
    };

    // Execute in parallel
    const [publicDataResult, collectionDataResult] = await Promise.allSettled([
        fetchPublicData(),
        fetchCollectionData()
    ]);

    if (publicDataResult.status === 'fulfilled') publicDataItems = publicDataResult.value;
    if (collectionDataResult.status === 'fulfilled') collectionPointItems = collectionDataResult.value;

    // C. Local JSON Lookup (Sync & Fast) - Enhanced with Supabase & Dong Logic
    if (sido) {
        try {
            let items: any[] = [];

            // 1. Try Supabase
            if (supabase) {
                try {
                    const { data, error } = await supabase
                        .from('waste_rules')
                        .select('*')
                        .ilike('sido', `%${sido}%`)
                        .ilike('sigungu', `%${sigungu}%`);
                    if (!error && data) items = data;
                } catch (e) { console.error("Recycle Supabase Error", e); }
            }

            // 2. Fallback to Local JSON
            if (items.length === 0) {
                items = (wasteRules as any[]).filter((rule: any) => {
                    return rule.sido.includes(sido) && rule.sigungu.includes(sigungu);
                });
            }

            // 3. Sort by Dong Priority (Enhanced)
            if (dong && items.length > 1) {
                items.sort((a, b) => {
                    const aName = a.emdNm || '';
                    const bName = b.emdNm || '';
                    // Check strict or partial match (Bidirectional)
                    const aMatch = aName && (dong.includes(aName) || aName.includes(dong));
                    const bMatch = bName && (dong.includes(bName) || bName.includes(dong));

                    if (aMatch && !bMatch) return -1;
                    if (!aMatch && bMatch) return 1;
                    return 0;
                });
            }

            wasteInfoItems = items;
        } catch (e) {
            console.error("Waste Info Lookup Error:", e);
        }
    }

    // 2. Use Gemini
    if (geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

            // Calculate Today's Info (KST)
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const kstGap = 9 * 60 * 60 * 1000;
            const todayKST = new Date(utc + kstGap);

            const days = ['일', '월', '화', '수', '목', '금', '토'];
            const dayName = days[todayKST.getDay()];
            const dateStr = `${todayKST.getMonth() + 1}월 ${todayKST.getDate()}일 ${dayName}요일`;
            const timeStr = `${todayKST.getHours()}시 ${todayKST.getMinutes()}분`;

            const methodContext = publicDataItems.map(item =>
                `- [분리배출 방법] 품목: ${item.itemNm}, 방법: ${item.dschgMthd}, 내용: ${item.contents || ''}`
            ).join('\n');

            const placeContext = collectionPointItems.map(item =>
                `- [수거처] 업체: ${item.bzentNm}, 품목: ${item.reutilKndNm || item.bizKndNm}, 주소: ${item.addr || item.roadAddr}`
            ).join('\n');

            const ruleContext = wasteInfoItems.slice(0, 3).map(item =>
                `- [배출규칙(${item.emdNm || '전체'})] 생활쓰레기: ${item.gnrlWsteDschrgMthd} (${item.gnrlWsteDschrgDay}, ${item.gnrlWsteDschrgTime}), 음식물: ${item.foodWsteDschrgMthd} (${item.foodWsteDschrgDay}, ${item.foodWsteDschrgTime}), 재활용: ${item.recycleDschrgMthd} (${item.recycleDschrgDay}, ${item.recycleDschrgTime})`
            ).join('\n');

            const prompt = `
                당신은 재활용 및 분리배출을 돕는 친절한 환경 마스코트 '에코'입니다.
                
                [현재 상황]
                - 사용자의 질문: "${query}"
                - 사용자의 현재 위치: ${location || '알 수 없음'} (${sido} ${sigungu})
                - **현재 시각: ${dateStr} ${timeStr}** (이 시간을 기준으로 "오늘", "내일", "지금" 배출 가능 여부를 판단하세요)

                [1. 공공데이터: 분리배출 방법 (핵심 - 배출 방법)]
                ${methodContext || "관련 데이터 없음"}

                [2. 공공데이터: 수거/회수처 (참고용 - 장소)]
                ${placeContext || "관련 데이터 없음"}

                [3. 로컬데이터: 우리 동네 배출 규칙 (핵심 - 시간/요일)]
                ${ruleContext || "지역 배출 규칙 데이터 없음"}

                [지시사항]
                1. **배출 방법(HOW)**을 물으면 [1. 공공데이터]를 최우선으로 참고하세요.
                2. **배출 시간/요일(WHEN)**이나 **오늘 버려도 되는지**를 물으면 [3. 로컬데이터]와 [현재 시각]을 비교하여 정확히 답변하세요.
                   - 예: 사용자가 "오늘 배출 가능?" 질문 시, 현재 요일(${dayName})이 배출 요일에 포함되는지 확인.
                3. 공공데이터 정보가 부족하거나 "전용수거함"같이 단편적이면, **그것이 무엇인지 일반 상식을 동원해 구체적으로 설명**해주세요.
                4. **중요: "데이터가 없다"는 말보다, 가지고 있는 정보(일반 상식 포함)로 최대한 해결책을 제시하세요.**
                5. **이모지 사용 제한:** 문장 중간에는 이모지를 사용하지 마세요. 답변의 맨 마지막에만 1개 또는 2개 정도의 웃는 얼굴 이모지(😊, 🙌 등)를 사용해 주세요. 시선이 분산되지 않도록 깔끔하게 작성해 주세요.
            `;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            return NextResponse.json({
                resultType: 'gemini',
                message: responseText,
                originalData: publicDataItems,
                collectionData: collectionPointItems,
                wasteData: wasteInfoItems
            });

        } catch (error: any) {
            console.error("Gemini Error:", error);
        }
    }

    // Fallback if Gemini fails
    if (publicDataItems.length > 0) {
        return NextResponse.json({
            resultType: 'list',
            response: { body: { items: publicDataItems } }
        });
    }

    // Ultimate Fallback
    return NextResponse.json({
        resultType: 'gemini',
        message: '죄송해요, 관련 정보를 찾을 수 없고 인공지능 연결도 원활하지 않아요. 잠시 후 다시 시도해주세요. 💦'
    });
}
