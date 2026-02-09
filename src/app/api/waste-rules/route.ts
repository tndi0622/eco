import { NextResponse } from 'next/server';
import wasteRules from '@/data/waste_rules.json';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sido = searchParams.get('sido');
    const sigungu = searchParams.get('sigungu');
    const dong = searchParams.get('dong');

    if (!sido || !sigungu) {
        return NextResponse.json({ error: 'Location (sido, sigungu) is required' }, { status: 400 });
    }

    try {
        // Filter rules from local JSON
        let items = (wasteRules as any[]).filter((rule: any) => {
            return rule.sido.includes(sido) && rule.sigungu.includes(sigungu);
        });

        // If dong provided, sort to prioritize dong-specific rules
        if (dong && items.length > 1) {
            items.sort((a, b) => {
                const aHasDong = a.emdNm && a.emdNm.includes(dong);
                const bHasDong = b.emdNm && b.emdNm.includes(dong);

                // 1. Exact/Partial inclusion of dong name
                if (aHasDong && !bHasDong) return -1;
                if (!aHasDong && bHasDong) return 1;

                // 2. Prefer specific matches over generic ones?
                // Actually, if we found a dong match, we took it.
                // If neither matches, we might prefer "Generic/Empty" over "Some Other Dong".
                // Example: User is "Sajik-dong". Items: "Gahoe-dong (specific)", "Jongno-gu (generic)"
                // We should prefer Generic if Specific doesn't match.

                const aIsGeneric = !a.emdNm || a.emdNm === "";
                const bIsGeneric = !b.emdNm || b.emdNm === "";

                if (aIsGeneric && !bIsGeneric) return -1;
                if (!aIsGeneric && bIsGeneric) return 1;

                return 0;
            });
        }

        // Debug: console.log(`Found ${items.length} rules for ${sido} ${sigungu} ${dong || ''}`);

        return NextResponse.json({ rules: items });

    } catch (error: any) {
        console.error('Waste Rules Local Error:', error);
        return NextResponse.json({ error: 'Failed to fetch waste rules' }, { status: 500 });
    }
}
