import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
        return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
    }

    try {
        // We add a User-Agent which is required by Nominatim policy
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=ko`,
            {
                headers: {
                    'User-Agent': 'EcoApp/1.0 (contact@example.com)'
                }
            }
        );

        if (!res.ok) {
            throw new Error(`Nominatim returned ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Proxy Geocoding error:', error);
        return NextResponse.json({ error: 'Failed to fetch address' }, { status: 500 });
    }
}
