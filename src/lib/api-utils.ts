/**
 * API Utility Functions
 */

/**
 * 위치 문자열을 시도, 시군구, 동으로 파싱합니다.
 * @param loc 위치 문자열 (예: "서울특별시 마포구 성산동")
 */
export const parseLocation = (loc: string | null) => {
    if (!loc || loc.includes('위치')) return { sido: '', sigungu: '', dong: '' };
    const parts = loc.split(' ');
    return {
        sido: parts[0] || '',
        sigungu: parts[1] || '',
        dong: parts[2] || ''
    };
};

/**
 * 타임아웃이 있는 fetch 래퍼입니다.
 * @param url 요청할 URL
 * @param ms 타임아웃 밀리초 (기본값: 2500ms)
 */
export const fetchWithTimeout = async (url: string, ms: number = 2500) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return await res.json();
    } catch (e) {
        clearTimeout(timeoutId);
        throw e;
    }
};

/**
 * 공공데이터 API 응답에서 아이템 목록을 추출합니다.
 */
export const getItems = (data: any) => {
    if (!data?.response?.body?.items) return [];
    const items = data.response.body.items;

    if (Array.isArray(items)) return items;
    if (typeof items === 'string' && items === '') return [];
    if (items?.item && Array.isArray(items.item)) return items.item;
    if (items?.item) return [items.item];

    return [];
};

/**
 * Gemini 모델 리스트
 */
export const AVAILABLE_GEMINI_MODELS = [
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-pro"
];
