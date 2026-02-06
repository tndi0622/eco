import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import wasteRules from '@/data/waste_rules.json';

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
        if (!loc || loc.includes('위치')) return { sido: '', sigungu: '' };
        const parts = loc.split(' ');
        // E.g. "대구광역시 중구 국채보상로" -> Sido: 대구광역시, Sigungu: 중구
        return {
            sido: parts[0] || '',
            sigungu: parts[1] || ''
        };
    };

    const { sido, sigungu } = parseLocation(location);

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

    // C. Local JSON Lookup (Sync & Fast)
    if (sido) {
        try {
            const items = (wasteRules as any[]).filter((rule: any) => {
                return rule.sido.includes(sido) && rule.sigungu.includes(sigungu);
            });
            wasteInfoItems = items;
        } catch (e) {
            console.error("Waste Info Local Error:", e);
        }
    }

    // 2. Use Gemini
    if (geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

            const methodContext = publicDataItems.map(item =>
                `- [분리배출 방법] 품목: ${item.itemNm}, 방법: ${item.dschgMthd}, 내용: ${item.contents || ''}`
            ).join('\n');

            const placeContext = collectionPointItems.map(item =>
                `- [수거처] 업체: ${item.bzentNm}, 품목: ${item.reutilKndNm || item.bizKndNm}, 주소: ${item.addr || item.roadAddr}`
            ).join('\n');

            const ruleContext = wasteInfoItems.map(item =>
                `- [배출규칙(${item.emdNm || '전체'})] 생활쓰레기: ${item.gnrlWsteDschrgMthd} (${item.gnrlWsteDschrgDay}, ${item.gnrlWsteDschrgTime}), 음식물: ${item.foodWsteDschrgMthd} (${item.foodWsteDschrgDay}, ${item.foodWsteDschrgTime})`
            ).join('\n');

            const prompt = `
                당신은 재활용 및 분리배출을 돕는 친절한 환경 마스코트 '에코'입니다.
                사용자의 질문: "${query}"
                사용자의 현재 위치: ${location || '알 수 없음'} (${sido} ${sigungu})

                [1. 공공데이터: 분리배출 방법]
                ${methodContext || "관련 데이터 없음"}

                [2. 공공데이터: 수거/회수처]
                ${placeContext || "주변 수거처 데이터 없음"}

                [3. 로컬데이터: 동네 배출 규칙]
                ${ruleContext || "해당 지역 로컬 규칙 없음"}

                [지시사항]
                1. 위 데이터를 종합하여 답변해주세요.
                2. 공공데이터에 정보가 없다면, **당신이 알고 있는 일반적인 상식**을 기반으로 답변해주세요.
                3. 답변은 친절하고 줄글 형태로 작성해주세요. (이모지 활용)
                4. 모른다고 하지 말고, 일반적인 방법이라도 안내해주세요.
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
