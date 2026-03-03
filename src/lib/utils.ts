/**
 * General Utility Functions
 */

/**
 * 한국어 조사 선택 헬퍼
 * @param word 대상 단어
 * @param josa 선택할 조사 종류
 * @returns 적절한 조사
 */
export const getJosa = (word: string, josa: '은/는' | '이/가' | '을/를') => {
    if (!word) return '';
    let lastCharIndex = word.length - 1;
    while (lastCharIndex >= 0) {
        const code = word.charCodeAt(lastCharIndex);
        if (code >= 0xAC00 && code <= 0xD7A3) break;
        lastCharIndex--;
    }
    if (lastCharIndex < 0) return josa;
    const lastCharCode = word.charCodeAt(lastCharIndex);
    const hasBatchim = (lastCharCode - 0xAC00) % 28 > 0;

    if (josa === '은/는') return hasBatchim ? '은' : '는';
    if (josa === '이/가') return hasBatchim ? '이' : '가';
    if (josa === '을/를') return hasBatchim ? '을' : '를';
    return josa;
};

/**
 * 질문에서 키워드와 상황(수정자)을 추출합니다.
 * @param text 질문 텍스트
 */
export const extractKeyword = (text: string) => {
    let cleanText = text.replace(/[?.!,]/g, '').trim();
    let modifier: string | null = null;

    if (cleanText.includes('묻은') || cleanText.includes('더러운') || cleanText.includes('음식물') || cleanText.includes('이물질')) {
        modifier = 'dirty';
    } else if (cleanText.includes('깨진') || cleanText.includes('파손된')) {
        modifier = 'broken';
    } else if (cleanText.includes('액체') || cleanText.includes('남은') || cleanText.includes('내용물')) {
        modifier = 'liquid';
    } else if (cleanText.includes('기름')) {
        modifier = 'oil';
    }

    const removePhrases = [
        '어떻게 버려요', '어떻게 버리나요', '어떻게 버려', '어떻게 처리해요',
        '버리는 법', '버리는 방법', '버리는법', '배출 방법', '배출법',
        '알려줘', '알려주세요', '어떻게', '버려요', '버려', '요',
        '처리', '수거', '폐기'
    ];

    for (const phrase of removePhrases) {
        if (cleanText.endsWith(phrase)) {
            cleanText = cleanText.substring(0, cleanText.length - phrase.length).trim();
        }
    }

    return { keyword: cleanText, modifier };
};

/**
 * 이미지 압축 및 리사이징 (Canvas 사용)
 * @param source 원본 File 또는 base64 이미지
 * @param maxWidth 최대 너비 (기본 1024px)
 * @param quality 압축 품질 (0~1, 기본 0.7)
 */
export const compressImage = (source: File | string, maxWidth = 1024, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        let objectUrl: string | null = null;

        img.onload = () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context could not be created'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            try {
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            } catch (e) {
                reject(new Error('이미지 변환 중 오류가 발생했습니다.'));
            }
        };

        img.onerror = (error) => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            console.error('Image compression error:', error);
            reject(new Error('이미지를 불러오는 중 오류가 발생했습니다.'));
        };

        // 핸들러를 먼저 등록한 후 src 설정 (Race Condition 방지)
        if (source instanceof File) {
            objectUrl = URL.createObjectURL(source);
            img.src = objectUrl;
        } else {
            img.src = source;
        }
    });
};
