import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const location = searchParams.get('loc');

    if (!query) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = process.env.DATA_GO_KR_API_KEY;
    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;

    // 1. Fetch Public Data (Fact Check)
    let publicDataItems: any[] = [];

    if (apiKey) {
        try {
            let apiUrl = `https://apis.data.go.kr/1482000/WasteRecyclingService/getRecycleList?serviceKey=${apiKey}&pageNo=1&numOfRows=10&itmNm=${encodeURIComponent(query)}&type=json`;

            // Retry logic (remove spaces)
            const fetchFromApi = async (url: string) => {
                const res = await fetch(url);
                if (!res.ok) return null;
                return res.json();
            };

            let data = await fetchFromApi(apiUrl);

            // Check emptiness helper
            const isDataEmpty = (d: any) => {
                if (!d?.response?.body?.items) return true;
                const items = d.response.body.items;
                if (Array.isArray(items) && items.length === 0) return true;
                if (typeof items === 'string' && items === '') return true;
                if (items.item && Array.isArray(items.item) && items.item.length === 0) return true;
                return false;
            };

            if (isDataEmpty(data) && query.includes(' ')) {
                const noSpaceQuery = query.replace(/\s+/g, '');
                apiUrl = `https://apis.data.go.kr/1482000/WasteRecyclingService/getRecycleList?serviceKey=${apiKey}&pageNo=1&numOfRows=10&itmNm=${encodeURIComponent(noSpaceQuery)}&type=json`;
                data = await fetchFromApi(apiUrl);
            }

            if (!isDataEmpty(data)) {
                const rawItems = data.response.body.items;
                if (Array.isArray(rawItems)) publicDataItems = rawItems;
                else if (Array.isArray(rawItems?.item)) publicDataItems = rawItems.item;
                else if (rawItems?.item) publicDataItems = [rawItems.item];
            }

        } catch (e) {
            console.error("Public API Error:", e);
        }
    }

    // 2. Use Gemini to generating natural response
    if (geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            // Use specific version to avoid 404 on aliases
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

            const contextItems = publicDataItems.map(item =>
                `- 품목명: ${item.itemNm}, 배출방법: ${item.dschgMthd}, 내용: ${item.contents || ''}`
            ).join('\n');

            const prompt = `
                당신은 재활용 및 분리배출을 돕는 친절한 환경 마스코트 '에코'입니다.
                사용자의 질문: "${query}"
                사용자의 상황/위치: ${location || '알 수 없음'}

                [공공데이터 검색 결과]
                ${contextItems ? contextItems : "공식적인 검색 결과가 없습니다."}

                [지시사항]
                1. 공공데이터 검색 결과가 있다면, 이를 바탕으로 정확하게 답변해주세요.
                2. 검색 결과가 없다면, 당신이 가진 일반적인 환경 지식을 활용해 답변해주세요. (단, "정확한 정보는 지자체 문의가 필요할 수 있다"는 점을 넌지시 언급해주세요.)
                3. "깨진", "묻은", "기름" 등의 맥락이 질문에 있다면, 그에 맞는 세심한 조언을(씻어서 버리기, 신문지로 싸기 등) 덧붙여주세요.
                4. 말투는 친절하고 이모지를 적절히 사용하여 대화하듯이 해주세요. (딱딱한 설명체 금지)
                5. 답변은 줄글 형태로 자연스럽게 답변해주세요. 마크다운 사용 가능.
            `;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            return NextResponse.json({
                resultType: 'gemini',
                message: responseText,
                originalData: publicDataItems
            });

        } catch (error: any) {
            console.error("Gemini Error Details:", {
                message: error.message,
                stack: error.stack,
                cause: error.cause,
                // Log additional GoogleGenerativeAI specific fields if they exist
                response: error.response,
                statusText: error.statusText
            });
            // Fallback to basic logic if Gemini fails
        }
    }

    // Fallback: If Gemini is missing or fails, return old style JSON
    return NextResponse.json({
        resultType: 'list',
        response: { body: { items: publicDataItems.length > 0 ? publicDataItems : null } }
    });
}
