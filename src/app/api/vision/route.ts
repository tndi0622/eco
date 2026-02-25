import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import wasteRules from '@/data/waste_rules.json';
import { supabase } from '@/lib/supabase';

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

    let query: string | undefined;
    let largeWasteItems: any[] = [];
    let wasteInfoItems: any[] = [];

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

    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

        // --- 1단계: 아이템 식별 ---
        const identificationPrompt = `
            Analyze this image and identify the main waste item.
            Return ONLY the single specific name of the item in Korean (e.g., "소파", "침대", "건전지", "투명페트병").
            Do not add any other text or punctuation.
        `;

        const imagePart = {
            inlineData: {
                data: image,
                mimeType: mimeType || "image/jpeg"
            },
        };

        const idResult = await model.generateContent([identificationPrompt, imagePart]);
        const identifiedItem = idResult.response.text().trim();
        query = identifiedItem;

        // --- 2단계: 공공데이터 가져오기 ---
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

        const getItems = (data: any) => {
            if (!data?.response?.body?.items) return [];
            const rawItems = data.response.body.items;
            if (Array.isArray(rawItems)) return rawItems;
            if (Array.isArray(rawItems?.item)) return rawItems.item;
            if (rawItems?.item) return [rawItems.item];
            return [];
        };

        const fetchLargeWasteData = async () => {
            try {
                let url = `https://api.data.go.kr/openapi/tn_pubr_public_lar_was_fee_api?serviceKey=${apiKey}&pageNo=1&numOfRows=100&type=json`;
                if (sido) url += `&ctpvNm=${encodeURIComponent(sido)}`;
                if (sigungu) url += `&sggNm=${encodeURIComponent(sigungu)}`;
                if (query) url += `&larWasNm=${encodeURIComponent(query)}`;
                const data = await fetchWithTimeout(url);
                return getItems(data);
            } catch (e) { return []; }
        };

        const [largeWasteResult] = await Promise.allSettled([
            fetchLargeWasteData()
        ]);

        largeWasteItems = largeWasteResult.status === 'fulfilled' ? largeWasteResult.value : [];

        // 로컬 데이터 (Supabase/JSON)
        if (sido) {
            try {
                if (supabase) {
                    const { data, error } = await supabase.from('waste_rules').select('*').ilike('sido', `%${sido}%`).ilike('sigungu', `%${sigungu}%`);
                    if (!error && data) wasteInfoItems = data;
                }
                if (wasteInfoItems.length === 0) {
                    wasteInfoItems = (wasteRules as any[]).filter((rule: any) => rule.sido.includes(sido) && rule.sigungu.includes(sigungu));
                }
                if (dong && wasteInfoItems.length > 1) {
                    wasteInfoItems.sort((a, b) => {
                        const aName = a.emdNm || '';
                        const bName = b.emdNm || '';
                        const aMatch = aName && (dong.includes(aName) || aName.includes(dong));
                        const bMatch = bName && (dong.includes(bName) || bName.includes(dong));
                        if (aMatch && !bMatch) return -1;
                        if (!aMatch && bMatch) return 1;
                        return 0;
                    });
                }
            } catch (e) { }
        }

        // --- 3단계: 최종 답변 ---
        const largeWasteContext = largeWasteItems.map(item => `- [대형폐기물 수수료] 지역: ${item.ctpvNm} ${item.sggNm}, 품목: ${item.larWasNm} (${item.larWasSeNm || ''}), 규격: ${item.larWasSpcfct}, 가격: ${item.fee}원, 문의: ${item.mngInstNm}`).join('\n');
        const ruleContext = wasteInfoItems.slice(0, 3).map(item => `- [배출규칙(${item.emdNm || '전체'})] 생활쓰레기: ${item.gnrlWsteDschrgMthd} (${item.gnrlWsteDschrgDay}, ${item.gnrlWsteDschrgTime}), 음식물: ${item.foodWsteDschrgMthd} (${item.foodWsteDschrgDay}, ${item.foodWsteDschrgTime}), 재활용: ${item.recycleDschrgMthd} (${item.recycleDschrgDay}, ${item.recycleDschrgTime})`).join('\n');

        const finalPrompt = `
            당신은 친절한 환경 마스코트 '에코'이며, **대형 폐기물 처리 전문가**입니다.
            사용자가 사진으로 업로드한 품목에 대한 올바른 처리 방법을 안내해 주세요.
            
            [1. 공공데이터: 규격별 수수료 내역]
            ${largeWasteContext || "관련 수수료 데이터가 직접적으로 없습니다. 유사 품목을 참고하세요."}

            [2. 로컬데이터: 우리 동네 배출 규칙]
            ${ruleContext || "지역 배출 규칙 데이터 없음"}
            
            [지시사항]
            1. 당신의 주요 임무는 사진 속 **대형 폐기물(가구, 가전 등)을 식별하고 정확한 수수료와 처리 절차를 안내**하는 것입니다.
            2. 식별된 품목이 무엇인지 언급하고, 사진상으로 보이는 **대략적인 크기를 [1. 수수료 내역]의 규격과 대조**하여 안내하세요.
            3. **규격별 수수료:** 가능한 모든 규격별 수수료(예: 1인용 5,000원, 2인용 10,000원 등)를 정확히 나열하세요.
            4. **스티커 구매처:** 어디서 스티커를 살 수 있는지(관할 지자체 홈페이지, 행정복지센터, 편의점, 마트 등) 구체적으로 명시하세요.
            5. **상세 배출 단계:** 
               - 신청/결제 -> 스티커 부착 -> 지정 장소(집 앞 등) 배출 과정을 순서대로 설명하세요.
            6. 가전제품인 경우 '폐가전 무상방문수거(1599-0903)'를 반드시 포함하세요.
            7. 답변은 **8문장 이내**로 명확하게 구성하고, 출처를 마지막에 꼭 명시하세요. 😊
            
            "정보 제공: 기후에너지환경부, 한국환경공단, 한국지능정보사회진흥원"
        `;

        const finalResult = await model.generateContent([finalPrompt, imagePart]);
        const responseText = finalResult.response.text();

        return NextResponse.json({
            resultType: 'gemini',
            message: responseText,
            identifiedItem: query
        });

    } catch (e: any) {
        console.error("Vision Analysis Error:", e);

        if (typeof query !== 'undefined' && largeWasteItems && largeWasteItems.length > 0) {
            return NextResponse.json({
                resultType: 'list',
                response: {
                    body: {
                        items: largeWasteItems
                    }
                },
                isFallback: true
            });
        }

        const isQuotaExceeded = e.status === 429 || e.message?.includes('429') || e.message?.includes('quota');
        const errorMessage = isQuotaExceeded
            ? '오늘의 AI 사용량이 초과되었습니다. 잠시 후 다시 시도하거나 나중에 이용해 주세요.'
            : (e.status === 503 || e.message?.includes('503'))
                ? 'AI 서비스가 현재 매우 혼잡합니다. 잠시 후 다시 시도해 주세요.'
                : '사진을 분석하는 도중 예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
        return NextResponse.json({ error: errorMessage }, { status: e.status || 500 });
    }
}
