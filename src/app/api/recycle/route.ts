import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import wasteRules from '@/data/waste_rules.json';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const location = searchParams.get('loc');

    if (!query) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = process.env.DATA_GO_KR_API_KEY;
    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey || !geminiKey) {
        return NextResponse.json({ error: 'API Keys missing' }, { status: 500 });
    }

    // 1. Data Containers
    let publicDataItems: any[] = [];      // Classification/Recycling Method
    let collectionPointItems: any[] = []; // Recovery Centers
    let wasteInfoItems: any[] = [];       // Living Waste Discharge Rules (Time/Place)
    let largeWasteItems: any[] = [];      // Large Waste Fee Info (New)
    let wasteBagItems: any[] = [];        // Waste Bag Price Info (New)
    let foodWasteItems: any[] = [];       // Food Waste Cert Price Info (New)

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

    const isDataEmpty = (d: any) => {
        if (!d?.response?.body?.items) return true;
        const items = d.response.body.items;
        if (Array.isArray(items) && items.length === 0) return true;
        if (typeof items === 'string' && items === '') return true;
        if (items?.item && Array.isArray(items.item) && items.item.length === 0) return true;
        return false;
    };

    const getItems = (data: any) => {
        if (isDataEmpty(data)) return [];
        const rawItems = data.response.body.items;
        if (Array.isArray(rawItems)) return rawItems;
        if (Array.isArray(rawItems?.item)) return rawItems.item;
        if (rawItems?.item) return [rawItems.item];
        return [];
    };

    // Parallel Fetching
    const fetchPublicData = async () => {
        try {
            let apiUrl = `https://apis.data.go.kr/1482000/WasteRecyclingService/getRecycleList?serviceKey=${apiKey}&pageNo=1&numOfRows=10&itmNm=${encodeURIComponent(query)}&type=json`;
            let data = await fetchWithTimeout(apiUrl);

            // Retry without spaces if empty
            if (isDataEmpty(data) && query.includes(' ')) {
                const noSpaceQuery = query.replace(/\s+/g, '');
                apiUrl = `https://apis.data.go.kr/1482000/WasteRecyclingService/getRecycleList?serviceKey=${apiKey}&pageNo=1&numOfRows=10&itmNm=${encodeURIComponent(noSpaceQuery)}&type=json`;
                data = await fetchWithTimeout(apiUrl);
            }
            return getItems(data);
        } catch (e) {
            return [];
        }
    };

    const fetchCollectionData = async () => {
        if (!sido) return [];
        try {
            const url = `https://apis.data.go.kr/B552584/kecoapi/reutilCltRtrvlBzentyService/getReutilCltRtrvlBzentyInfo?serviceKey=${apiKey}&numOfRows=5&pageNo=1&returnType=json&sido=${encodeURIComponent(sido)}&gunGu=${encodeURIComponent(sigungu)}`;
            const data = await fetchWithTimeout(url);
            return getItems(data);
        } catch (e) {
            return [];
        }
    };

    const fetchLargeWasteData = async () => {
        try {
            let url = `https://api.data.go.kr/openapi/tn_pubr_public_lar_was_fee_api?serviceKey=${apiKey}&pageNo=1&numOfRows=100&type=json`;
            if (sido) url += `&ctpvNm=${encodeURIComponent(sido)}`;
            if (sigungu) url += `&sggNm=${encodeURIComponent(sigungu)}`;
            if (query) url += `&larWasNm=${encodeURIComponent(query)}`;
            const data = await fetchWithTimeout(url);
            return getItems(data);
        } catch (e) {
            return [];
        }
    };

    const fetchWasteBagData = async () => {
        try {
            let url = `https://api.data.go.kr/openapi/tn_pubr_public_weighted_envlp_api?serviceKey=${apiKey}&pageNo=1&numOfRows=100&type=json`;
            if (sido) url += `&ctpvNm=${encodeURIComponent(sido)}`;
            if (sigungu) url += `&sggNm=${encodeURIComponent(sigungu)}`;
            const data = await fetchWithTimeout(url);
            return getItems(data);
        } catch (e) {
            return [];
        }
    };

    const fetchFoodWasteData = async () => {
        try {
            let url = `https://api.data.go.kr/openapi/tn_pubr_public_food_trash_api?serviceKey=${apiKey}&pageNo=1&numOfRows=100&type=json`;
            if (sido) url += `&ctpvNm=${encodeURIComponent(sido)}`;
            if (sigungu) url += `&sggNm=${encodeURIComponent(sigungu)}`;
            const data = await fetchWithTimeout(url);
            return getItems(data);
        } catch (e) { return []; }
    };

    // Execute in parallel
    const [publicDataResult, collectionDataResult, largeWasteResult, wasteBagResult, foodWasteResult] = await Promise.allSettled([
        fetchPublicData(),
        fetchCollectionData(),
        fetchLargeWasteData(),
        fetchWasteBagData(),
        fetchFoodWasteData()
    ]);

    if (publicDataResult.status === 'fulfilled') publicDataItems = publicDataResult.value;
    if (collectionDataResult.status === 'fulfilled') collectionPointItems = collectionDataResult.value;
    if (largeWasteResult.status === 'fulfilled') largeWasteItems = largeWasteResult.value;
    if (wasteBagResult.status === 'fulfilled') wasteBagItems = wasteBagResult.value;
    if (foodWasteResult.status === 'fulfilled') foodWasteItems = foodWasteResult.value;

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

            const largeWasteContext = largeWasteItems.map(item =>
                `- [대형폐기물 수수료] 지역: ${item.ctpvNm} ${item.sggNm}, 품목: ${item.larWasNm} (${item.larWasSeNm || ''}), 규격: ${item.larWasSpcfct}, 가격: ${item.fee}원, 문의: ${item.mngInstNm}`
            ).join('\n');

            const wasteBagContext = wasteBagItems.map(item =>
                `- [종량제봉투] 지역: ${item.ctpvNm} ${item.sggNm}, 종류: ${item.weightedEnvlpKndNm}, 용도: ${item.weightedEnvlpPrposNm}, 용량: ${item.weightedEnvlpCpcty}, 가격: ${item.price}원, 판매처: ${item.purchsStoreNm || '지정판매소'}`
            ).join('\n');

            const foodWasteContext = foodWasteItems.map(item =>
                `- [음식물납부필증] 지역: ${item.ctpvNm} ${item.sggNm}, 유형: ${item.foodTrashPayCertTypeNm}, 대상: ${item.useTrgtNm}, 용량: ${item.foodTrashCpcty}, 가격: ${item.price}원`
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

                [2. 공공데이터: 대형폐기물 수수료 (핵심 - 대형일 경우)]
                ${largeWasteContext || "관련 데이터 없음 (대형폐기물이 아닐 수 있음)"}

                [3. 공공데이터: 종량제봉투/납부필증 가격 (핵심 - 가격 문의 시)]
                ${wasteBagContext || ""}
                ${foodWasteContext || ""}

                [4. 공공데이터: 수거/회수처 (참고용 - 장소)]
                ${placeContext || "관련 데이터 없음"}

                [5. 로컬데이터: 우리 동네 배출 규칙 (핵심 - 시간/요일)]
                ${ruleContext || "지역 배출 규칙 데이터 없음"}

                [지시사항]
                1. **배출 방법(HOW)**을 물으면 [1. 공공데이터]와 [2. 대형폐기물]을 최우선으로 참고하세요.
                2. 질문이 **대형 폐기물**(가구, 가전 등) 관련이면 [2. 대형폐기물] 데이터를 활용하여 **규격별 가격**과 **관리 기관**을 정확히 안내해 주세요.
                3. **종량제 봉투**, **음식물 칩/스티커** 가격을 물으면 [3. 데이터]를 참고하여 용량별 가격을 안내해 주세요.
                4. **배출 시간/요일(WHEN)**이나 **오늘 버려도 되는지**를 물으면 [5. 로컬데이터]와 [현재 시각]을 비교하여 정확히 답변하세요.
                   - 예: 사용자가 "오늘 배출 가능?" 질문 시, 현재 요일(${dayName})이 배출 요일에 포함되는지 확인.
                5. 공공데이터 정보가 부족하거나 "전용수거함"같이 단편적이면, **그것이 무엇인지 일반 상식을 동원해 구체적으로 설명**해주세요.
                6. **중요: "데이터가 없다"는 말보다, 가지고 있는 정보(일반 상식 포함)로 최대한 해결책을 제시하세요.**
                7. **이모지 사용 제한:** 문장 중간에는 이모지를 사용하지 마세요. 답변의 맨 마지막에만 1개 또는 2개 정도의 웃는 얼굴 이모지(😊, 🙌 등)를 사용해 주세요. 시선이 분산되지 않도록 깔끔하게 작성해 주세요.
            `;

            const result = await model.generateContentStream(prompt);

            const stream = new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    try {
                        for await (const chunk of result.stream) {
                            const chunkText = chunk.text();
                            controller.enqueue(encoder.encode(chunkText));
                        }
                        controller.close();
                    } catch (e) {
                        controller.error(e);
                    }
                },
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Transfer-Encoding': 'chunked',
                },
            });

        } catch (error: any) {
            console.error("Gemini Error:", error);
            return NextResponse.json({ error: '인공지능 서비스 연결 오류' }, { status: 500 });
        }
    }

    // Fallback if Gemini fails
    if (publicDataItems.length > 0 || largeWasteItems.length > 0) {
        return NextResponse.json({
            resultType: 'list',
            response: {
                body: {
                    items: [...publicDataItems, ...largeWasteItems]
                }
            }
        });
    }

    // Ultimate Fallback
    return NextResponse.json({
        message: '죄송해요, 관련 정보를 찾을 수 없고 인공지능 연결도 원활하지 않아요. 잠시 후 다시 시도해주세요. 💦'
    }, { status: 500 });
}
