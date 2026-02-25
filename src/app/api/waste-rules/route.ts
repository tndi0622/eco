import { NextResponse } from 'next/server';
import wasteRules from '@/data/waste_rules.json';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sido = searchParams.get('sido');
    const sigungu = searchParams.get('sigungu');
    const dong = searchParams.get('dong');

    if (!sido || !sigungu) {
        return NextResponse.json({ error: 'Location (sido, sigungu) is required' }, { status: 400 });
    }

    try {
        let items: any[] = [];
        let source = 'json';

        // 1. Supabase 시도
        if (supabase) {
            try {
                // ilike에 대한 URL 인코딩 처리가 필요한가? 아니오, supabase 클라이언트가 처리함.
                // 더 나은 매칭을 위해 시군구 정리 (예: "중구청" -> "중구")
                const cleanSigungu = sigungu.replace(/[시구군]청$/, '');

                const { data, error } = await supabase
                    .from('waste_rules')
                    .select('*')
                    .ilike('sido', `%${sido.substring(0, 2)}%`) // "대구광역시"에 대해 "대구" 매칭
                    .ilike('sigungu', `%${cleanSigungu}%`);

                if (!error && data) {
                    items = data;
                    source = 'supabase';
                }
            } catch (err) {
                console.error("Supabase Fetch Error:", err);
            }
        }

        // 2. 로컬 JSON으로 폴백
        if (items.length === 0) {
            source = 'json';
            const cleanSigungu = sigungu.replace(/[시구군]청$/, '');
            const cleanSido = sido.substring(0, 2);

            items = (wasteRules as any[]).filter((rule: any) => {
                return rule.sido.includes(cleanSido) && rule.sigungu.includes(cleanSigungu);
            });
        }

        // 동(dong)이 제공된 경우, 특정 동 규칙을 우선하도록 정렬
        if (dong && items.length > 1) {
            items.sort((a, b) => {
                const aHasDong = a.emdNm && a.emdNm.includes(dong);
                const bHasDong = b.emdNm && b.emdNm.includes(dong);

                // 1. 동 이름의 정확한 포함 또는 부분 포함
                if (aHasDong && !bHasDong) return -1;
                if (!aHasDong && bHasDong) return 1;

                // 2. 일반적인 매칭보다 특정 매칭 선호?
                const aIsGeneric = !a.emdNm || a.emdNm === "";
                const bIsGeneric = !b.emdNm || b.emdNm === "";

                if (aIsGeneric && !bIsGeneric) return -1;
                if (!aIsGeneric && bIsGeneric) return 1;

                return 0;
            });
        }

        return NextResponse.json({ rules: items, source }, {
            headers: {
                'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=59'
            }
        });

    } catch (error: any) {
        console.error('Waste Rules Local Error:', error);
        return NextResponse.json({ error: 'Failed to fetch waste rules' }, { status: 500 });
    }
}
