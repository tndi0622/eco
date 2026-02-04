import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = process.env.DATA_GO_KR_API_KEY;
    if (!apiKey) {
        console.error("DATA_GO_KR_API_KEY is missing.");
        return NextResponse.json({ error: 'Server API Key missing' }, { status: 500 });
    }

    // Operation Name: getRecycleList (Guessing based on common patterns, if fails we try others or ask user)
    // Also trying: getRecyclingInfo
    // Parameter for search: itmNm (Item Name) or searchKeyword
    // Let's try itmNm first which is common for item search.

    // Try getRecycleList first
    let apiUrl = `https://apis.data.go.kr/1482000/WasteRecyclingService/getRecycleList?serviceKey=${apiKey}&pageNo=1&numOfRows=10&itmNm=${encodeURIComponent(query)}&type=json`;

    try {
        let response = await fetch(apiUrl);

        // If 404, maybe operation name is wrong.
        if (response.status === 404) {
            console.log("getRecycleList not found, trying getNongsaroRecycleList");
            // Just a guess, sometimes Nongsaro is involved? No.
            // Let's try 'getItem' as suggested by search
            apiUrl = `https://apis.data.go.kr/1482000/WasteRecyclingService/getItem?serviceKey=${apiKey}&pageNo=1&numOfRows=10&itemNm=${encodeURIComponent(query)}&type=json`;
            response = await fetch(apiUrl);
        }

        if (!response.ok) {
            const text = await response.text();
            console.error("API Error Response:", text);
            return NextResponse.json({ error: `API Error: ${response.status} ${response.statusText}`, details: text }, { status: response.status });
        }

        const data = await response.json();
        console.log("Recycle API Response:", JSON.stringify(data, null, 2));

        // The response structure usually: response -> body -> items -> item
        // Check for success code if JSON
        if (data.response?.header?.resultCode !== '00') {
            // handle error from API body
            console.error("API Header Error:", data.response?.header);
        }

        return NextResponse.json(data);

    } catch (error) {
        console.error("Failed to fetch recycle info:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
