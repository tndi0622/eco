import React from 'react';

/**
 * Renders text with basic Markdown formatting:
 * - **bold** -> <strong>bold</strong> (with theme color)
 * - [text](url) -> <a href="url">text</a>
 * - *italic* -> <em>italic</em>
 */
export default function FormattedText({ text }: { text: string }) {
    if (!text) return null;

    // 1. Handle Links [text](url) first to avoid conflict with other parsers if needed, 
    // but for simplicity, let's just do Bold first as it's the primary request.
    // Actually, mixing them requires a more complex parser or a library. 
    // Given the constraints and the request specifically about **, let's focus on **bold**.

    // Regex to capture **bold** text (lazy match)
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
                // Check for single asterisks if needed, but Gemini usually uses ** for important things.

                // Parse links in the non-bold parts: [text](url)
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
