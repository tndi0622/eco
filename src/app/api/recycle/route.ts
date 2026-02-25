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

    // 데이터 컨테이너 선언
    let largeWasteItems: any[] = [];
    let wasteInfoItems: any[] = [];

    // 헬퍼: 위치 파싱
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

    // 헬퍼: 타임아웃 래퍼
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

    // 대형 폐기물 데이터 가져오기
    try {
        const [largeWasteResult] = await Promise.allSettled([
            fetchLargeWasteData()
        ]);
        if (largeWasteResult.status === 'fulfilled') largeWasteItems = largeWasteResult.value;

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

        // Gemini 사용
        if (geminiKey) {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const kstGap = 9 * 60 * 60 * 1000;
            const todayKST = new Date(utc + kstGap);
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            const dayName = days[todayKST.getDay()];
            const dateStr = `${todayKST.getMonth() + 1}월 ${todayKST.getDate()}일 ${dayName}요일`;
            const timeStr = `${todayKST.getHours()}시 ${todayKST.getMinutes()}분`;

            const largeWasteContext = largeWasteItems.map(item =>
                `- [수수료 정보] 지역: ${item.ctpvNm} ${item.sggNm}, 품목: ${item.larWasNm}, 규격: ${item.larWasSpcfct}, 가격: ${item.fee}원, 담당부서: ${item.mngInstNm}`
            ).join('\n');

            const ruleContext = wasteInfoItems.slice(0, 3).map(item =>
                `- [신청안내(${item.sigungu})] 방법: ${item.gnrlWsteDschrgMthd || '관할 지자체 홈페이지 또는 지정 판매소 스티커 구매'} (동네별 상세: ${item.emdNm || '전체'})`
            ).join('\n');

            const prompt = `
                당신은 대한민국 거주자들을 위해 **대형 폐기물(가구, 가전 등) 처리 방법을 전문적으로 안내하는 AI 비서 '에코'**입니다. 
                사용자가 버리려는 물건의 **정확한 수수료 정보, 스티커 구매처, 그리고 상세한 배출 단계**를 안내하는 것이 당신의 핵심 임무입니다.
                
                [현재 상황]
                - 사용자의 품목: "${query}"
                - 사용자 위치: ${location || '알 수 없음'}
                - 현재 시각: ${dateStr} ${timeStr}

                [공공데이터: 규격별 수수료 내역]
                ${largeWasteContext || "해당 품목의 수수료 데이터가 직접적으로 없습니다. 유사 품목의 수수료를 참고하여 답변하세요."}

                [로컬데이터: 지역별 신청 방법 및 배출 요령]
                ${ruleContext || "지역별 특이사항 없음 (통상 관할 구청 홈페이지 신청)"}

                [지시사항]
                1. **수수료 안내 (정확성):** [공공데이터]의 문구(규격)를 그대로 인용하여 **크기별/규격별 수수료**를 명확히 목록화해서 알려주세요. 사용자가 자신의 물건 크기를 보고 판단할 수 있게 하세요.
                2. **스티커 구매 및 결제:** 어디서 스티커를 살 수 있는지(예: 관할 지자체(구청, 시청 등) 홈페이지 온라인 신청 후 출력, 근처 편의점, 마트, 지정판매소 등)를 구체적으로 명시하세요.
                3. **상세 배출 프로세스:** 
                   - 1단계: 신청 및 결제 (홈페이지 또는 방문)
                   - 2단계: 납부필증(스티커) 부착 또는 접수번호 기재
                   - 3단계: 정해진 시간(주로 해가 진 후)에 지정된 장소(집 앞 등)로 배출
                4. **가전제품:** 대형 가전(냉장고, 세탁기 등)은 '폐가전 무상방문수거 서비스(1599-0903)'로 무상 배출이 가능하다는 점을 강조하세요.
                5. **비대상 품목:** 대형 폐기물이 아니면 짧게 안내 후 대형 폐기물 안내로 유도하세요.
                6. **답변 스타일:** 서론은 생략하고 **항목별(수수료/구매처/방법)**로 구분하여 8문장 이내로 명확히 작성하세요. 😊
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
                    } catch (e) { controller.error(e); }
                },
            });

            return new Response(stream, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
            });
        }
    } catch (error: any) {
        console.error("Gemini Error:", error);
        if (largeWasteItems.length > 0) {
            return NextResponse.json({
                resultType: 'list',
                response: { body: { items: largeWasteItems } },
                isFallback: true,
                fallbackReason: error.status === 429 ? 'quota_exceeded' : 'api_error'
            });
        }
        const isQuotaExceeded = error.status === 429 || error.message?.includes('429') || error.message?.includes('quota');
        const errorMessage = isQuotaExceeded
            ? '오늘의 AI 사용량이 초과되었습니다. 잠시 후 다시 시도하거나 나중에 이용해 주세요.'
            : (error.status === 503 || error.message?.includes('503'))
                ? 'AI 서비스가 현재 매우 혼잡합니다. 잠시 후 다시 시도해 주세요.'
                : 'AI 서비스 연결 중에 오류가 발생했습니다.';
        return NextResponse.json({ error: errorMessage }, { status: error.status || 500 });
    }

    if (largeWasteItems.length > 0) {
        return NextResponse.json({
            resultType: 'list',
            response: { body: { items: largeWasteItems } }
        });
    }

    return NextResponse.json({
        message: '죄송해요, 관련 정보를 찾을 수 없고 인공지능 연결도 원활하지 않아요. 잠시 후 다시 시도해주세요. 💦'
    }, { status: 500 });
}
