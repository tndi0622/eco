import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
        return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
    }

    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=ko`,
            {
                headers: {
                    'User-Agent': 'EcoSearchApp/1.0 (contact@example.com)',
                    'Accept': 'application/json',
                    'Referer': 'http://localhost:3000'
                },
                next: { revalidate: 3600 } // 캐싱 추가로 호출 횟수 최적화
            }
        );

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`Nominatim Error (${res.status}):`, errorText);
            return NextResponse.json({ error: '지도 서비스 응답 오류' }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Proxy Geocoding error:', error);
        return NextResponse.json({ error: '위치 정보를 가져오지 못했습니다' }, { status: 500 });
    }
}
