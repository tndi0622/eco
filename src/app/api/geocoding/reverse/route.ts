import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
        return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
    }

    /* 
    const apiKey = process.env.KAKAO_REST_API_KEY;
    if (!apiKey) {
        console.error('KAKAO_REST_API_KEY is not defined in environment variables');
        return NextResponse.json({ error: 'API 키 설정이 누락되었습니다' }, { status: 500 });
    }
    */

    try {
        // 1. Photon API (가장 안정적이고 제한이 적음)
        const photonRes = await fetch(
            `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`,
            { headers: { 'Accept-Language': 'ko' } }
        );

        if (photonRes.ok) {
            const data = await photonRes.json();
            if (data.features && data.features.length > 0) {
                const p = data.features[0].properties;
                return NextResponse.json({
                    address: {
                        province: p.state || p.city || "",
                        city: p.city || p.county || "",
                        suburb: p.district || p.suburb || "",
                        road: p.street || p.name || "",
                        house_number: p.housenumber || "",
                        building: p.name !== p.street ? p.name : ""
                    },
                    display_name: p.name || "주소를 찾았습니다"
                });
            }
        }

        // 2. Photon 실패 시 Nominatim 시도 (User-Agent를 포함하여 차단 우회)
        const nominatimRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=ko`,
            {
                headers: {
                    'User-Agent': 'EcoRecycleApp/1.3 (admin@eco-recycle.com)'
                }
            }
        );

        if (nominatimRes.ok) {
            const n = await nominatimRes.json();
            return NextResponse.json(n);
        }

        return NextResponse.json({ error: '지도 서비스 응답 일시 제한' }, { status: 503 });
    } catch (error) {
        console.error('Geocoding error:', error);
        return NextResponse.json({ error: '위치 정보를 가져오지 못했습니다' }, { status: 500 });
    }
}
