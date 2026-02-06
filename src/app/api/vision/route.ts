import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
    const { image, location } = await request.json();

    if (!image) {
        return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!geminiKey) {
        return NextResponse.json({ error: 'Gemini Key missing' }, { status: 500 });
    }

    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        // Use gemini-1.5-flash for vision capabilities
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            당신은 친절한 환경 마스코트 '에코'입니다.
            사용자가 방금 업로드한 쓰레기 사진을 보고, 올바른 분리배출 방법을 알려줘야 합니다.
            
            사용자 위치: ${location || "알 수 없음"}

            [지시사항]
            1. 사진 속 물건이 무엇인지 파악하고, 그 물건의 이름을 언급해주세요. (예: "이건 배달 떡볶이 용기네요!")
            2. 해당 물건을 어떻게 버려야 하는지 구체적인 단계(세척, 분리 등)를 포함해 설명해주세요.
            3. 재활용이 가능한지, 불가능한지(종량제 등) 명확히 알려주세요.
            4. 말투는 친절하고 이모지를 사용해주세요.
            5. 만약 사진이 쓰레기와 관련이 없다면, 정중하게 다시 질문해달라고 하세요.
            
            짧고 명확하게 답변해주세요.
        `;

        const imagePart = {
            inlineData: {
                data: image,
                mimeType: "image/jpeg"
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text();

        return NextResponse.json({
            resultType: 'gemini',
            message: responseText
        });

    } catch (e: any) {
        console.error("Vision Analysis Error:", e);
        return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 });
    }
}
