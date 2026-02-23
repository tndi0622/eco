import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
        return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
    }

    const apiKey = process.env.KAKAO_REST_API_KEY;

    try {
        // 카카오 로컬 API (좌표 -> 주소 변환) 호출
        const res = await fetch(
            `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lon}&y=${lat}`,
            {
                headers: {
                    'Authorization': `KakaoAK ${apiKey}`
                }
            }
        );

        if (!res.ok) {
            console.error(`Kakao API Error: ${res.status}`);
            return NextResponse.json({ error: '지도 서비스 응답 일시 제한' }, { status: res.status });
        }

        const data = await res.json();

        if (data.documents && data.documents.length > 0) {
            const doc = data.documents[0];
            const address = doc.road_address || doc.address;

            // 기존 앱 로직과 호환되는 포맷으로 변환
            return NextResponse.json({
                address: {
                    province: address.region_1depth_name || "",
                    city: address.region_2depth_name || "",
                    city_district: "", // 카카오는 상위 필드에 포함됨
                    suburb: address.region_3depth_name || "",
                    road: address.road_name || "",
                    house_number: address.main_building_no || "",
                    building: address.building_name || ""
                },
                display_name: address.address_name
            });
        }

        return NextResponse.json({ error: '주소를 찾을 수 없습니다' }, { status: 404 });
    } catch (error) {
        console.error('Kakao Geocoding error:', error);
        return NextResponse.json({ error: '위치 정보를 가져오지 못했습니다' }, { status: 500 });
    }
}
