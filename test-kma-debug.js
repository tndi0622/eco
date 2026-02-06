
const https = require('https');

const keys = [
    'wQQuXCrfSZGELlwq3ymRNg', // User's new key
    'c7c9950c1f91a266a3e39644a7febeac35730f42a49c79b07e676d84e4d1bbe1' // Existing recycling key
];

// Fixed coordinates for Seoul
const nx = 60;
const ny = 127;

const today = new Date();
const baseDate = today.toISOString().slice(0, 10).replace(/-/g, '');

// Logic for Ultra Short Term (Hourly)
let hour = today.getHours();
if (today.getMinutes() < 45) hour--;
if (hour < 0) hour = 23; // Simple day wrap skip for test
const baseTimeUltra = String(hour).padStart(2, '0') + '30';

// Logic for Village Forecast (3-hourly: 02, 05, 08, 11, 14, 17, 20, 23)
// Pick closest past base time
const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23];
let closeTime = baseTimes[0];
const currentHour = today.getHours();
for (let t of baseTimes) {
    if (t <= currentHour) closeTime = t;
}
const baseTimeVilage = String(closeTime).padStart(2, '0') + '00';

const endpoints = [
    { name: 'UltraSrtFcst', path: '/getUltraSrtFcst', baseTime: baseTimeUltra },
    { name: 'VilageFcst', path: '/getVilageFcst', baseTime: baseTimeVilage }
];

function check(key, endpoint) {
    const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0${endpoint.path}?serviceKey=${key}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${baseDate}&base_time=${endpoint.baseTime}&nx=${nx}&ny=${ny}`;

    console.log(`Checking [${endpoint.name}] with Key [${key.substring(0, 6)}...]`);

    https.get(url, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            console.log(`[${endpoint.name}] Status: ${res.statusCode}`);
            try {
                const json = JSON.parse(data);
                if (json.response?.header?.resultCode === '00') {
                    console.log(`[${endpoint.name}] SUCCESS!`);
                } else {
                    console.log(`[${endpoint.name}] Failed Logic: ${json.response?.header?.resultMsg}`);
                }
            } catch (e) {
                console.log(`[${endpoint.name}] Not JSON (Likely XML Error or Auth Error)`);
            }
            console.log('---');
        });
    }).on('error', e => console.error(e.message));
}

keys.forEach(k => {
    endpoints.forEach(e => check(k, e));
});
