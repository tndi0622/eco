import { NextResponse } from 'next/server';
import wasteRules from '@/data/waste_rules.json';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sido = searchParams.get('sido');
    const sigungu = searchParams.get('sigungu');
    // Optional: add 'dong' or 'emd' support later if geolocation provides it

    if (!sido || !sigungu) {
        return NextResponse.json({ error: 'Location (sido, sigungu) is required' }, { status: 400 });
    }

    try {
        // Filter rules from local JSON
        // Using `includes` allows partial matches (e.g. "Seoul" vs "Seoul Metropolitan City") if data varies, 
        // but exact match is better if standardized. The CSV seems to have standard names.
        // We'll filter for matches.

        const items = (wasteRules as any[]).filter((rule: any) => {
            return rule.sido.includes(sido) && rule.sigungu.includes(sigungu);
        });

        // Debug: console.log(`Found ${items.length} rules for ${sido} ${sigungu}`);

        return NextResponse.json({ rules: items });

    } catch (error: any) {
        console.error('Waste Rules Local Error:', error);
        return NextResponse.json({ error: 'Failed to fetch waste rules' }, { status: 500 });
    }
}
