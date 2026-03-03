import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import wasteRules from '@/data/waste_rules.json';
import { supabase } from '@/lib/supabase';
import { parseLocation, fetchWithTimeout, getItems, AVAILABLE_GEMINI_MODELS } from '@/lib/api-utils';

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

    const { sido, sigungu, dong } = parseLocation(location);

    const isDataEmpty = (d: any) => {
        if (!d?.response?.body?.items) return true;
        const items = d.response.body.items;
        if (Array.isArray(items) && items.length === 0) return true;
        if (typeof items === 'string' && items === '') return true;
        if (items?.item && Array.isArray(items.item) && items.item.length === 0) return true;
        return false;
    };

    // 1. 공공데이터 가져오기 함수들
    const fetchPublicData = async () => {
        try {
            let apiUrl = `https://apis.data.go.kr/1482000/WasteRecyclingService/getRecycleList?serviceKey=${apiKey}&pageNo=1&numOfRows=10&itmNm=${encodeURIComponent(query)}&type=json`;
            let data = await fetchWithTimeout(apiUrl);

            if (isDataEmpty(data) && query.includes(' ')) {
                const noSpaceQuery = query.replace(/\s+/g, '');
                apiUrl = `https://apis.data.go.kr/1482000/WasteRecyclingService/getRecycleList?serviceKey=${apiKey}&pageNo=1&numOfRows=10&itmNm=${encodeURIComponent(noSpaceQuery)}&type=json`;
                data = await fetchWithTimeout(apiUrl);
            }
            return getItems(data);
        } catch (e) { return []; }
    };

    const fetchCollectionData = async () => {
        if (!sido) return [];
        try {
            const url = `https://apis.data.go.kr/B552584/kecoapi/reutilCltRtrvlBzentyService/getReutilCltRtrvlBzentyInfo?serviceKey=${apiKey}&numOfRows=5&pageNo=1&returnType=json&sido=${encodeURIComponent(sido)}&gunGu=${encodeURIComponent(sigungu)}`;
            return getItems(await fetchWithTimeout(url));
        } catch (e) { return []; }
    };

    const fetchLargeWasteData = async () => {
        try {
            let url = `https://api.data.go.kr/openapi/tn_pubr_public_lar_was_fee_api?serviceKey=${apiKey}&pageNo=1&numOfRows=100&type=json`;
            if (sido) url += `&ctpvNm=${encodeURIComponent(sido)}`;
            if (sigungu) url += `&sggNm=${encodeURIComponent(sigungu)}`;
            if (query) url += `&larWasNm=${encodeURIComponent(query)}`;
            return getItems(await fetchWithTimeout(url));
        } catch (e) { return []; }
    };

    const fetchWasteBagData = async () => {
        try {
            let url = `https://api.data.go.kr/openapi/tn_pubr_public_weighted_envlp_api?serviceKey=${apiKey}&pageNo=1&numOfRows=100&type=json`;
            if (sido) url += `&ctpvNm=${encodeURIComponent(sido)}`;
            if (sigungu) url += `&sggNm=${encodeURIComponent(sigungu)}`;
            return getItems(await fetchWithTimeout(url));
        } catch (e) { return []; }
    };

    const fetchFoodWasteData = async () => {
        try {
            let url = `https://api.data.go.kr/openapi/tn_pubr_public_food_trash_api?serviceKey=${apiKey}&pageNo=1&numOfRows=100&type=json`;
            if (sido) url += `&ctpvNm=${encodeURIComponent(sido)}`;
            if (sigungu) url += `&sggNm=${encodeURIComponent(sigungu)}`;
            return getItems(await fetchWithTimeout(url));
        } catch (e) { return []; }
    };

    // 병렬로 실행
    const [publicDataResult, collectionDataResult, largeWasteResult, wasteBagResult, foodWasteResult] = await Promise.allSettled([
        fetchPublicData(),
        fetchCollectionData(),
        fetchLargeWasteData(),
        fetchWasteBagData(),
        fetchFoodWasteData()
    ]);

    const publicDataItems = publicDataResult.status === 'fulfilled' ? publicDataResult.value : [];
    const collectionPointItems = collectionDataResult.status === 'fulfilled' ? collectionDataResult.value : [];
    const largeWasteItems = largeWasteResult.status === 'fulfilled' ? largeWasteResult.value : [];
    const wasteBagItems = wasteBagResult.status === 'fulfilled' ? wasteBagResult.value : [];
    const foodWasteItems = foodWasteResult.status === 'fulfilled' ? foodWasteResult.value : [];
    let wasteInfoItems: any[] = [];

    // 로컬 데이터 조회
    if (sido) {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('waste_rules').select('*').ilike('sido', `%${sido.substring(0, 2)}%`).ilike('sigungu', `%${sigungu}%`);
                if (!error && data) wasteInfoItems = data;
            }
            if (wasteInfoItems.length === 0) {
                wasteInfoItems = (wasteRules as any[]).filter((rule: any) => rule.sido.includes(sido.substring(0, 2)) && rule.sigungu.includes(sigungu));
            }
            if (dong && wasteInfoItems.length > 1) {
                wasteInfoItems.sort((a, b) => {
                    const aMatch = a.emdNm && (dong.includes(a.emdNm) || a.emdNm.includes(dong));
                    const bMatch = b.emdNm && (dong.includes(b.emdNm) || b.emdNm.includes(dong));
                    return aMatch ? -1 : (bMatch ? 1 : 0);
                });
            }
        } catch (e) { }
    }

    // Gemini 답변 생성
    const genAI = new GoogleGenerativeAI(geminiKey);
    let lastError: any = null;

    for (const modelName of AVAILABLE_GEMINI_MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });

            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const kstGap = 9 * 60 * 60 * 1000;
            const todayKST = new Date(utc + kstGap);
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            const dayName = days[todayKST.getDay()];
            const dateStr = `${todayKST.getMonth() + 1}월 ${todayKST.getDate()}일 ${dayName}요일`;
            const timeStr = `${todayKST.getHours()}시 ${todayKST.getMinutes()}분`;

            const methodContext = publicDataItems.map((item: any) => `- [분리배출 방법] 품목: ${item.itemNm}, 방법: ${item.dschgMthd}, 내용: ${item.contents || ''}`).join('\n');
            const placeContext = collectionPointItems.map((item: any) => `- [수거처] 업체: ${item.bzentNm}, 품목: ${item.reutilKndNm || item.bizKndNm}, 주소: ${item.addr || item.roadAddr}`).join('\n');
            const largeWasteContext = largeWasteItems.map((item: any) => `- [대형폐기물] 지역: ${item.ctpvNm} ${item.sggNm}, 품목: ${item.larWasNm}, 규격: ${item.larWasSpcfct}, 가격: ${item.fee}원`).join('\n');
            const wasteBagContext = wasteBagItems.map((item: any) => `- [종량제봉투] 지역: ${item.ctpvNm} ${item.sggNm}, 용량: ${item.weightedEnvlpCpcty}, 가격: ${item.price}원`).join('\n');
            const ruleContext = wasteInfoItems.slice(0, 3).map((item: any) => `- [배출규칙(${item.emdNm || '전체'})] 일반: ${item.gnrlWsteDschrgDay}, 음식물: ${item.foodWsteDschrgDay}, 재활용: ${item.recycleDschrgDay}`).join('\n');

            const prompt = `
                당신은 재활용 전문가 친절한 '에코'입니다.
                - 질문: "${query}"
                - 위치: ${location || '알 수 없음'}
                - 현재: ${dateStr} ${timeStr}

                [공공데이터 데이터]
                ${methodContext || "재활용 방법 정보 없음"}
                ${largeWasteContext || ""}
                ${wasteBagContext || ""}
                ${placeContext || ""}
                ${ruleContext || ""}

                [지시사항]
                1. 핵심 위주로 요약하여 친절하게 답변하세요.
                2. 대형 폐기물인 경우 가격 정보를 포함하세요.
                3. 배출 시간/요일 문의 시 기준 시각과 로컬 데이터를 비교해 안내하세요.
                4. 이모지는 답변 마지막에만 1-2개 사용하세요.
            `;

            const result = await model.generateContentStream(prompt);

            const stream = new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    try {
                        for await (const chunk of result.stream) {
                            controller.enqueue(encoder.encode(chunk.text()));
                        }
                        controller.close();
                    } catch (e) { controller.error(e); }
                },
            });

            return new Response(stream, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
            });

        } catch (error: any) {
            console.error(`Gemini Model ${modelName} Error:`, error);
            lastError = error;
            continue;
        }
    }

    // 폴백
    if (publicDataItems.length > 0 || largeWasteItems.length > 0) {
        return NextResponse.json({
            resultType: 'list',
            items: [...publicDataItems, ...largeWasteItems]
        });
    }

    const fallbackMsg = lastError?.status === 503 || lastError?.message?.includes('503') || lastError?.status === 429
        ? '서비스가 매우 혼잡합니다. 잠시 후 시도해 주세요.'
        : '오류가 발생했습니다.';

    return NextResponse.json({ error: fallbackMsg }, { status: 500 });
}
