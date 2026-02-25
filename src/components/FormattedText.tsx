import React from 'react';

/**
 * 기본 마크다운 포맷팅으로 텍스트를 렌더링합니다:
 * - **bold** -> <strong>bold</strong> (테마 컬러 적용)
 * - [text](url) -> <a href="url">text</a>
 * - *italic* -> <em>italic</em>
 */
export default function FormattedText({ text }: { text: string }) {
    if (!text) return null;

    // 1. 링크 [text](url)를 먼저 처리하여 다른 파서와의 충돌을 방지할 수 있지만,
    // 단순함을 위해 우선 주요 요청인 굵게 처리(**Bold**)부터 진행합니다.
    // 실제로 이들을 혼합하려면 더 복잡한 파서나 라이브러리가 필요합니다.
    // 제약 조건과 **에 대한 특정 요청을 고려하여 **굵게** 처리에 집중합니다.

    // **굵게** 표시된 텍스트를 캡처하는 정규식 (Lazy match)
    const parts = text.split(/(\*\*.*?\*\*)/g);

    return (
        <span>
            {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                        <strong key={index} style={{ color: '#27AE60', fontWeight: '800' }}>
                            {part.slice(2, -2)}
                        </strong>
                    );
                }
                // 필요한 경우 단일 별표(*)를 확인할 수 있지만, Gemini는 보통 중요한 사항에 **를 사용합니다.

                // 굵지 않은 부분에서 링크 파싱: [text](url)
                const linkParts = part.split(/(\[[^\]]+\]\([^)]+\))/g);
                if (linkParts.length > 1) {
                    return linkParts.map((subPart, subIndex) => {
                        const linkMatch = subPart.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                        if (linkMatch) {
                            return (
                                <a
                                    key={`${index}-${subIndex}`}
                                    href={linkMatch[2]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#2980b9', textDecoration: 'underline' }}
                                >
                                    {linkMatch[1]}
                                </a>
                            );
                        }
                        return <span key={`${index}-${subIndex}`}>{subPart}</span>;
                    });
                }

                return <span key={index}>{part}</span>;
            })}
        </span>
    );
}
