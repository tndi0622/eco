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

    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

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
        const query = identifiedItem;

        // --- 2단계: 공공데이터 가져오기 (병렬) ---

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

        const fetchPublicData = async () => {
            try {
                const url = `https://apis.data.go.kr/1482000/WasteRecyclingService/getRecycleList?serviceKey=${apiKey}&pageNo=1&numOfRows=10&itmNm=${encodeURIComponent(query)}&type=json`;
                const data = await fetchWithTimeout(url);
                return getItems(data);
            } catch (e) { return []; }
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

        const fetchWasteBagData = async () => {
            try {
                let url = `https://api.data.go.kr/openapi/tn_pubr_public_weighted_envlp_api?serviceKey=${apiKey}&pageNo=1&numOfRows=100&type=json`;
                if (sido) url += `&ctpvNm=${encodeURIComponent(sido)}`;
                if (sigungu) url += `&sggNm=${encodeURIComponent(sigungu)}`;
                const data = await fetchWithTimeout(url);
                return getItems(data);
            } catch (e) { return []; }
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

        const fetchCollectionData = async () => {
            if (!sido) return [];
            try {
                const url = `https://apis.data.go.kr/B552584/kecoapi/reutilCltRtrvlBzentyService/getReutilCltRtrvlBzentyInfo?serviceKey=${apiKey}&numOfRows=5&pageNo=1&returnType=json&sido=${encodeURIComponent(sido)}&gunGu=${encodeURIComponent(sigungu)}`;
                const data = await fetchWithTimeout(url);
                return getItems(data);
            } catch (e) { return []; }
        };

        const [publicDataResult, collectionDataResult, largeWasteResult, wasteBagResult, foodWasteResult] = await Promise.allSettled([
            fetchPublicData(),
            fetchCollectionData(),
            fetchLargeWasteData(),
            fetchWasteBagData(),
            fetchFoodWasteData()
        ]);

        let publicDataItems: any[] = publicDataResult.status === 'fulfilled' ? publicDataResult.value : [];
        let collectionPointItems: any[] = collectionDataResult.status === 'fulfilled' ? collectionDataResult.value : [];
        let largeWasteItems: any[] = largeWasteResult.status === 'fulfilled' ? largeWasteResult.value : [];
        let wasteBagItems: any[] = wasteBagResult.status === 'fulfilled' ? wasteBagResult.value : [];
        let foodWasteItems: any[] = foodWasteResult.status === 'fulfilled' ? foodWasteResult.value : [];
        let wasteInfoItems: any[] = [];

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
                // 동(Dong)별로 정렬
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
        // 컨텍스트 구축
        const methodContext = publicDataItems.map(item => `- [분리배출 방법] 품목: ${item.itemNm}, 방법: ${item.dschgMthd}, 내용: ${item.contents || ''}`).join('\n');
        const largeWasteContext = largeWasteItems.map(item => `- [대형폐기물 수수료] 지역: ${item.ctpvNm} ${item.sggNm}, 품목: ${item.larWasNm} (${item.larWasSeNm || ''}), 규격: ${item.larWasSpcfct}, 가격: ${item.fee}원, 문의: ${item.mngInstNm}`).join('\n');
        const wasteBagContext = wasteBagItems.map(item => `- [종량제봉투] 지역: ${item.ctpvNm} ${item.sggNm}, 종류: ${item.weightedEnvlpKndNm}, 용도: ${item.weightedEnvlpPrposNm}, 용량: ${item.weightedEnvlpCpcty}, 가격: ${item.price}원, 판매처: ${item.purchsStoreNm || '지정판매소'}`).join('\n');
        const foodWasteContext = foodWasteItems.map(item => `- [음식물납부필증] 지역: ${item.ctpvNm} ${item.sggNm}, 유형: ${item.foodTrashPayCertTypeNm}, 대상: ${item.useTrgtNm}, 용량: ${item.foodTrashCpcty}, 가격: ${item.price}원`).join('\n');
        const placeContext = collectionPointItems.map(item => `- [수거처] 업체: ${item.bzentNm}, 품목: ${item.reutilKndNm || item.bizKndNm}, 주소: ${item.addr || item.roadAddr}`).join('\n');
        const ruleContext = wasteInfoItems.slice(0, 3).map(item => `- [배출규칙(${item.emdNm || '전체'})] 생활쓰레기: ${item.gnrlWsteDschrgMthd} (${item.gnrlWsteDschrgDay}, ${item.gnrlWsteDschrgTime}), 음식물: ${item.foodWsteDschrgMthd} (${item.foodWsteDschrgDay}, ${item.foodWsteDschrgTime}), 재활용: ${item.recycleDschrgMthd} (${item.recycleDschrgDay}, ${item.recycleDschrgTime})`).join('\n');

        const finalPrompt = `
            당신은 친절한 환경 마스코트 '에코'입니다.
            사용자가 사진으로 업로드한 **"${query}"**에 대한 올바른 처리 방법을 안내해 주세요.
            
            [사용자 정보]
            - 위치: ${location || "알 수 없음"} (${sido} ${sigungu})
            - 물건: ${query}

            [1. 공공데이터: 분리배출 방법]
            ${methodContext || "관련 데이터 없음"}

            [2. 공공데이터: 대형폐기물 수수료 (가구/가전일 경우 필수 참고)]
            ${largeWasteContext || "관련 데이터 없음"}

            [3. 공공데이터: 종량제/음식물 가격 참고]
            ${wasteBagContext || ""}
            ${foodWasteContext || ""}

            [4. 로컬데이터: 우리 동네 배출 규칙]
            ${ruleContext || "지역 배출 규칙 데이터 없음"}
            
            [5. 공공데이터: 수거처 정보]
            ${placeContext || ""}

            [지시사항]
            1. 먼저 **"${query}"**이(가) 무엇인지 확인했다고 언급해주세요.
            2. 위 [공공데이터]를 최대한 활용하여, 해당 물건의 정확한 배출 방법과 비용(수수료, 봉투가격 등)을 안내하세요.
            3. 데이터가 없다면, 일반적인 올바른 배출 방법을 친절하게 설명해주세요.
            4. **출처 표기(필수):** 답변의 맨 마지막 줄에 다음 출처를 꼭 명시해 주세요:
               "정보 제공: 기후에너지환경부, 한국환경공단, 한국지능정보사회진흥원"
            5. 이모지는 문장 끝에만 사용해주세요.
            
            짧고 명확하게 답변해주세요.
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
        return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 });
    }
}
