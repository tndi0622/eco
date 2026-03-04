import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import wasteRules from '@/data/waste_rules.json';
import { supabase } from '@/lib/supabase';
import { parseLocation, fetchWithTimeout, getItems, AVAILABLE_GEMINI_MODELS } from '@/lib/api-utils';

export const runtime = 'edge';

export async function POST(request: Request) {
    const { image, location, mimeType } = await request.json();

    if (!image) {
        return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    const apiKey = process.env.DATA_GO_KR_API_KEY;
    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey || !geminiKey) {
        return NextResponse.json({ error: 'API Keys missing' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    let query = "";
    let lastIdentificationError: any = null;

    // --- 1단계: 아이템 식별 ---
    const imagePart = {
        inlineData: {
            data: image,
            mimeType: mimeType || "image/jpeg"
        },
    };

    for (const modelName of AVAILABLE_GEMINI_MODELS) {
        try {
            console.log(`Attempting identification with model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const identificationPrompt = `
                Analyze this image and identify the main waste item.
                Return ONLY the single specific name of the item in Korean (e.g., "소파", "침대", "건전지", "투명페트병").
                Do not add any other text or punctuation.
            `;

            const idResult = await model.generateContent([identificationPrompt, imagePart]);
            const response = await idResult.response;
            const text = response.text().trim();

            console.log(`Model ${modelName} identified item: ${text}`);
            if (text) {
                query = text;
                break;
            }
        } catch (e: any) {
            console.error(`Identification Model ${modelName} Error:`, e);
            console.error(`Error details: ${e.message || 'No message'}, Status: ${e.status || 'No status'}`);
            lastIdentificationError = e;
        }
    }

    if (!query) {
        console.error("Identification failed for all models. Last Error:", lastIdentificationError);
        const errorMessage = lastIdentificationError?.status === 503 || lastIdentificationError?.message?.includes('503') || lastIdentificationError?.status === 429
            ? 'AI 서비스가 현재 매우 혼잡하여 품목 식별에 실패했습니다.'
            : `사진에서 품목을 식별하는 도중 오류가 발생했습니다. (${lastIdentificationError?.message || 'Unknown Error'})`;
        return NextResponse.json({
            error: errorMessage,
            details: lastIdentificationError?.message,
            modelsAttempted: AVAILABLE_GEMINI_MODELS
        }, { status: 500 });
    }

    // --- 2단계: 공공데이터 가져오기 (병렬) ---
    const { sido, sigungu, dong } = parseLocation(location);

    const [publicDataResult, collectionDataResult, largeWasteResult, wasteBagResult, foodWasteResult] = await Promise.allSettled([
        (async () => {
            let url = `https://apis.data.go.kr/1482000/WasteRecyclingService/getRecycleList?serviceKey=${apiKey}&pageNo=1&numOfRows=10&itmNm=${encodeURIComponent(query)}&type=json`;
            let res = await fetchWithTimeout(url);
            let items = getItems(res);

            // 검색 결과가 없으면 공백 제거 후 재시도
            if (items.length === 0 && query.includes(' ')) {
                const noSpaceQuery = query.replace(/\s+/g, '');
                url = `https://apis.data.go.kr/1482000/WasteRecyclingService/getRecycleList?serviceKey=${apiKey}&pageNo=1&numOfRows=10&itmNm=${encodeURIComponent(noSpaceQuery)}&type=json`;
                res = await fetchWithTimeout(url);
                items = getItems(res);
            }
            return items;
        })(),
        (async () => {
            if (!sido) return [];
            const url = `https://apis.data.go.kr/B552584/kecoapi/reutilCltRtrvlBzentyService/getReutilCltRtrvlBzentyInfo?serviceKey=${apiKey}&numOfRows=5&pageNo=1&returnType=json&sido=${encodeURIComponent(sido)}&gunGu=${encodeURIComponent(sigungu)}`;
            return getItems(await fetchWithTimeout(url));
        })(),
        (async () => {
            let url = `https://api.data.go.kr/openapi/tn_pubr_public_lar_was_fee_api?serviceKey=${apiKey}&pageNo=1&numOfRows=100&type=json`;
            if (sido) url += `&ctpvNm=${encodeURIComponent(sido)}`;
            if (sigungu) url += `&sggNm=${encodeURIComponent(sigungu)}`;
            if (query) url += `&larWasNm=${encodeURIComponent(query)}`;
            return getItems(await fetchWithTimeout(url));
        })(),
        (async () => {
            let url = `https://api.data.go.kr/openapi/tn_pubr_public_weighted_envlp_api?serviceKey=${apiKey}&pageNo=1&numOfRows=100&type=json`;
            if (sido) url += `&ctpvNm=${encodeURIComponent(sido)}`;
            if (sigungu) url += `&sggNm=${encodeURIComponent(sigungu)}`;
            return getItems(await fetchWithTimeout(url));
        })(),
        (async () => {
            let url = `https://api.data.go.kr/openapi/tn_pubr_public_food_trash_api?serviceKey=${apiKey}&pageNo=1&numOfRows=100&type=json`;
            if (sido) url += `&ctpvNm=${encodeURIComponent(sido)}`;
            if (sigungu) url += `&sggNm=${encodeURIComponent(sigungu)}`;
            return getItems(await fetchWithTimeout(url));
        })()
    ]);

    const publicDataItems = publicDataResult.status === 'fulfilled' ? publicDataResult.value : [];
    const collectionPointItems = collectionDataResult.status === 'fulfilled' ? collectionDataResult.value : [];
    const largeWasteItems = largeWasteResult.status === 'fulfilled' ? largeWasteResult.value : [];
    const wasteBagItems = wasteBagResult.status === 'fulfilled' ? wasteBagResult.value : [];
    const foodWasteItems = foodWasteResult.status === 'fulfilled' ? foodWasteResult.value : [];
    let wasteInfoItems: any[] = [];

    // 로컬 데이터
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

    // --- 3단계: 최종 답변 생성 (Gemini) ---
    let lastSummaryError: any = null;

    for (const modelName of AVAILABLE_GEMINI_MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });

            const methodContext = publicDataItems.map((item: any) => `- ${item.itemNm}: ${item.dschgMthd}`).join('\n');
            const largeWasteContext = largeWasteItems.map((item: any) => `- ${item.larWasNm} (${item.larWasSpcfct}): ${item.fee}원`).join('\n');
            const ruleContext = wasteInfoItems.slice(0, 2).map((item: any) => `- [배출규칙] 일반: ${item.gnrlWsteDschrgDay}, 음식물: ${item.foodWsteDschrgDay}, 재활용: ${item.recycleDschrgDay}`).join('\n');

            const finalPrompt = `
                당신은 재활용 전문가 '에코'입니다. 사용자가 촬영한 사진 속 물체는 **"${query}"**입니다.
                
                [공공데이터: 분리배출 방법]
                ${methodContext || "관련 데이터 없음"}

                [공공데이터: 대형폐기물 수수료]
                ${largeWasteContext || "관련 데이터 없음"}

                [로컬데이터: 우리 동네 배출 규칙]
                ${ruleContext || "지역 배출 규칙 데이터 없음"}

                [지시사항]
                1. 물체를 확인했다고 짧게 언급하며 시작하세요.
                2. 위 데이터를 활용해 **핵심 배출 방법과 비용만 요약**해서 안내하세요. 간결함이 생명입니다.
                3. 데이터가 없다면 상식 수준에서 가장 중요한 포인트만 2~3문장 이내로 설명하세요.
                4. 답변 끝에 반드시 "정보 제공: 기후에너지환경부, 한국환경공단, 한국지능정보사회진흥원"을 명시하세요.
                5. 이모지는 문장 끝에만 1~2개 사용해 주세요.
            `;

            const finalResult = await model.generateContent([finalPrompt, imagePart]);
            const responseText = finalResult.response.text();

            return NextResponse.json({
                resultType: 'gemini',
                message: responseText,
                identifiedItem: query
            });

        } catch (e: any) {
            console.error(`Summary Model ${modelName} Error:`, e);
            lastSummaryError = e;
            continue;
        }
    }

    // 모든 모델 실패 시 폴백
    if (publicDataItems.length > 0 || largeWasteItems.length > 0) {
        return NextResponse.json({
            resultType: 'list',
            response: {
                body: { items: [...publicDataItems, ...largeWasteItems] }
            },
            identifiedItem: query
        });
    }

    const fallbackMsg = lastSummaryError?.status === 503 || lastSummaryError?.message?.includes('503') || lastSummaryError?.status === 429
        ? 'AI 서비스가 현재 매우 혼잡합니다. 잠시 후 다시 시도해 주세요.'
        : '상세 안내를 생성하는 도중 오류가 발생했습니다.';

    return NextResponse.json({
        error: fallbackMsg,
        message: '죄송해요, 관련 정보를 찾을 수 없고 AI 연결도 원활하지 않아요. 💦',
        identifiedItem: query
    }, { status: 500 });
}
