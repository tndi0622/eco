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
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // --- 1단계: 아이템 식별 ---
        const identificationPrompt = `
            Analyze this image and identify the main waste item.
            1. Item Name: A descriptive name (e.g., "3인용 가죽 소파").
            2. Search Keyword: A simple base keyword for database lookup (e.g., "소파").
            
            Return ONLY in JSON format:
            {"itemName": "...", "searchKeyword": "..."}
        `;

        const imagePart = {
            inlineData: {
                data: image,
                mimeType: mimeType || "image/jpeg"
            },
        };

        const idResult = await model.generateContent([identificationPrompt, imagePart]);
        let idJson;
        try {
            const idText = idResult.response.text().trim().replace(/```json|```/g, '');
            idJson = JSON.parse(idText);
        } catch (e) {
            // JSON 파싱 실패 시 텍스트 기반 폴백
            const text = idResult.response.text().trim();
            idJson = { itemName: text, searchKeyword: text.split(' ')[0] };
        }

        const itemName = idJson.itemName;
        query = idJson.searchKeyword; // 검색용 키워드로 공공데이터 조회

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
        const largeWasteContext = largeWasteItems.slice(0, 15).map(item => `- [대형폐기물 수수료] 품목: ${item.larWasNm}, 규격: ${item.larWasSpcfct}, 가격: ${item.fee}원`).join('\n');
        const ruleContext = wasteInfoItems.slice(0, 2).map(item => `- [배출규칙] 생활쓰레기: ${item.gnrlWsteDschrgMthd}, 재활용: ${item.recycleDschrgMthd}`).join('\n');

        const finalPrompt = `
            당신은 친절한 환경 마스코트 '에코'이며, **대형 폐기물 처리 전문가**입니다.
            사용자가 사진으로 업로드한 품목을 분석한 결과는 다음과 같습니다:
            - 식별된 항목: **${itemName}**
            - 검색 키워드: ${query}
            
            [1. 우리 지역 공공데이터: 규격 및 수수료 내역]
            ${largeWasteContext || "제공된 데이터가 없습니다. 일반적인 수수료 범위를 안내하세요."}

            [2. 지역 배출 규칙]
            ${ruleContext || "지자체 홈페이지를 확인하세요."}
            
            [지시사항 - 반드시 지킬 것]
            1. **수수료 리스트 필수 출력**: [1. 공공데이터]에 있는 **모든 규격과 가격(원)**을 하나도 빠짐없이 목록 형태로 정확히 나열하세요.
            2. **맞춤 안내**: 사진 속 물건의 크기가 데이터의 어떤 규격에 해당하는지 판단하여 추천 가격을 알려주세요.
            3. **배출 절차**: 스티커 구매처와 배출 과정(신청->부착->지정장소 배출)을 명확히 안내하세요.
            4. **무상 수거**: 가전제품인 경우 '폐가전 무상방문수거(1599-0903)'를 반드시 포함하세요.
            5. **답변 스타일**: 수수료 정보가 가장 눈에 띄게 구성하고, 친절한 말투를 유지하며 8문장 내외로 작성하세요. 😊
            
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
