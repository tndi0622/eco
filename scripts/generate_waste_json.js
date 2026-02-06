const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const { parse } = require('csv-parse/sync');

const csvPath = path.join(__dirname, '../data/생활쓰레기배출정보.csv');
const jsonPath = path.join(__dirname, '../src/data/waste_rules.json');

// Helper to normalize day string "일+월" -> "일,월"
const normalizeDays = (str) => {
    if (!str) return '';
    return str.replace(/\+/g, ',');
};

try {
    const buffer = fs.readFileSync(csvPath);
    const decoded = iconv.decode(buffer, 'euc-kr');

    const records = parse(decoded, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });

    const mappedData = records.map(r => ({
        sido: r['시도명'],
        sigungu: r['시군구명'],
        emdNm: (r['관리구역명'] === '없음' || !r['관리구역명']) ? (r['관리구역대상지역명'] === '없음' ? '' : r['관리구역대상지역명']) : r['관리구역명'],
        gnrlWsteDschrgDay: normalizeDays(r['생활쓰레기배출요일']),
        gnrlWsteDschrgMthd: r['생활쓰레기배출방법'],
        foodWsteDschrgDay: normalizeDays(r['음식물쓰레기배출요일']),
        foodWsteDschrgMthd: r['음식물쓰레기배출방법'],
        recycleDschrgDay: normalizeDays(r['재활용품배출요일']),
        recycleDschrgMthd: r['재활용품배출방법'],
        dschrgPlace: r['배출장소'],
        noCollectionDay: r['미수거일'],
        gnrlWsteDschrgTime: `${r['생활쓰레기배출시작시각']}~${r['생활쓰레기배출종료시각']}`,
        foodWsteDschrgTime: `${r['음식물쓰레기배출시작시각']}~${r['음식물쓰레기배출종료시각']}`,
        recycleDschrgTime: `${r['재활용품배출시작시각']}~${r['재활용품배출종료시각']}`,
        contact: r['관리부서전화번호']
    }));

    // Ensure output directory exists (src/data might not exist)
    const dir = path.dirname(jsonPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(jsonPath, JSON.stringify(mappedData, null, 2), 'utf-8');
    console.log(`Successfully generated ${jsonPath} with ${mappedData.length} records.`);

} catch (e) {
    console.error("Error:", e);
    process.exit(1);
}
