import { NextResponse } from 'next/server';
import { parseStringPromise } from 'xml2js';
import { fetchWithTimeout, getItems } from '@/lib/api-utils';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
        return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
    }

    // 월을 2자리로 포맷팅
    const solMonth = month.padStart(2, '0');
    const apiKey = process.env.DATA_GO_KR_API_KEY;

    if (!apiKey) {
        console.error("DATA_GO_KR_API_KEY is missing. Please restart the development server to load the new .env.local file.");
        return NextResponse.json({ error: 'Server API Key missing. Please restart the server.' }, { status: 500 });
    }

    // 키의 인코딩 필요 여부 결정.
    // 현재 키는 특수 문자(+, /, = 등)가 없으므로 표준 URL 인코딩은 필요하지 않아 보임.
    // 하지만 데이터 공유 포털(data.go.kr)의 경우, 라이브러리가 자동 인코딩을 수행하면 'Decoding' 키를 사용하고,
    // 직접 URL을 구성할 때는 'Encoding' 키를 사용하는 것이 일반적임.
    // 이 키는 특수 문자가 없으므로 그냥 URL에 포함해도 안전함.

    const apiUrl = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${apiKey}&solYear=${year}&solMonth=${solMonth}&numOfRows=100&_type=json`;

    try {
        const response = await fetchWithTimeout(apiUrl);
        if (!response.ok) throw new Error('API fetch failed');

        const data = await response.json();

        // JSON 응답인 경우 (data.go.kr의 공휴일 API는 _type=json 지원함)
        const items = getItems(data);

        const holidays = items.map((item: any) => ({
            date: `${String(item.locdate).substring(0, 4)}-${String(item.locdate).substring(4, 6)}-${String(item.locdate).substring(6, 8)}`,
            name: item.dateName,
            isHoliday: item.isHoliday === 'Y'
        }));

        return NextResponse.json({ holidays });

    } catch (error) {
        console.error('Failed to fetch holidays:', error);
        // XML로 재시도 또는 에러 반환
        return NextResponse.json({ error: 'Internal Server Error', holidays: [] }, { status: 500 });
    }
}
