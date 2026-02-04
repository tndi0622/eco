import { NextResponse } from 'next/server';
import { parseStringPromise } from 'xml2js';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
        return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
    }

    // Format month to 2 digits
    const solMonth = month.padStart(2, '0');
    const apiKey = process.env.DATA_GO_KR_API_KEY;

    if (!apiKey) {
        console.error("DATA_GO_KR_API_KEY is missing. Please restart the development server to load the new .env.local file.");
        return NextResponse.json({ error: 'Server API Key missing. Please restart the server.' }, { status: 500 });
    }

    // Determine if key needs encoding. 
    // The provided key: c7c9950c1f91a266a3e39644a7febeac35730f42a49c79b07e676d84e4d1bbe1 
    // Looks like it might NOT need standard URL encoding (no special chars like + or / or =).
    // But usually, ServiceKey parameter expects the key.
    // Let's try sending it as is. If that fails, we might need to double check.
    // Actually, for data.go.kr, usually we use the "Decoding" key if we use a library that auto-encodes (like axios or fetch + URLSearchParams).
    // If we construct the query string manually, we use "Encoding" key.
    // Since we are appending it to a URL string manually (to be safe with special chars in official keys), we should handle it carefully.
    // BUT, this key has NO special characters. So it is safe to just put in URL.

    const apiUrl = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${apiKey}&solYear=${year}&solMonth=${solMonth}&numOfRows=100`;

    try {
        const response = await fetch(apiUrl);
        const text = await response.text();

        console.log(`API Call to: ${apiUrl}`); // Debugging
        // console.log(`Response: ${text.substring(0, 200)}...`); 

        const result = await parseStringPromise(text, { explicitArray: false, ignoreAttrs: true });

        // Check for service error
        if (result.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg) {
            console.error('OpenAPI Error:', result.OpenAPI_ServiceResponse.cmmMsgHeader.errMsg);
            return NextResponse.json({ error: 'OpenAPI Error', details: result.OpenAPI_ServiceResponse.cmmMsgHeader }, { status: 500 });
        }

        const body = result.response?.body;
        if (!body || !body.items) {
            return NextResponse.json({ holidays: [] });
        }

        let items = body.items.item;
        // Normalize to array if single item
        if (!Array.isArray(items)) {
            items = [items];
        }

        const holidays = items.map((item: any) => ({
            date: `${item.locdate.substring(0, 4)}-${item.locdate.substring(4, 6)}-${item.locdate.substring(6, 8)}`,
            name: item.dateName,
            isHoliday: item.isHoliday === 'Y'
        }));

        return NextResponse.json({ holidays });

    } catch (error) {
        console.error('Failed to fetch holidays:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
