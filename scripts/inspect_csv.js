const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const { parse } = require('csv-parse/sync');

const csvPath = path.join(__dirname, '../data/생활쓰레기배출정보.csv');

try {
    const buffer = fs.readFileSync(csvPath);
    const decoded = iconv.decode(buffer, 'euc-kr');

    const records = parse(decoded, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });

    console.log("Headers:", Object.keys(records[0]));
    console.log("First Row:", records[0]);

} catch (e) {
    console.error("Error:", e);
}
