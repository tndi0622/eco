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

        // 1. Try Supabase
        if (supabase) {
            try {
                // Must handle URL encoding for ilike? No, supabase client handles it.
                const { data, error } = await supabase
                    .from('waste_rules')
                    .select('*')
                    .ilike('sido', `%${sido}%`)
                    .ilike('sigungu', `%${sigungu}%`);

                if (!error && data) {
                    items = data;
                    source = 'supabase';
                }
            } catch (err) {
                console.error("Supabase Fetch Error:", err);
            }
        }

        // 2. Fallback to Local JSON
        if (items.length === 0) {
            source = 'json';
            items = (wasteRules as any[]).filter((rule: any) => {
                return rule.sido.includes(sido) && rule.sigungu.includes(sigungu);
            });
        }

        // If dong provided, sort to prioritize dong-specific rules
        if (dong && items.length > 1) {
            items.sort((a, b) => {
                const aHasDong = a.emdNm && a.emdNm.includes(dong);
                const bHasDong = b.emdNm && b.emdNm.includes(dong);

                // 1. Exact/Partial inclusion of dong name
                if (aHasDong && !bHasDong) return -1;
                if (!aHasDong && bHasDong) return 1;

                // 2. Prefer specific matches over generic ones?
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
