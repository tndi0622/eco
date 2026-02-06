const SERVICE_KEY = 'c7c9950c1f91a266a3e39644a7febeac35730f42a49c79b07e676d84e4d1bbe1';
const BASE_URL = 'https://apis.data.go.kr/B552584/kecoapi/reutilCltRtrvlBzentyService/getReutilCltRtrvlBzentyInfo';

async function fetchData() {
    try {
        // Construct URL manually to avoid auto-encoding issues if key is strict
        const url = `${BASE_URL}?serviceKey=${SERVICE_KEY}&numOfRows=10&pageNo=1&returnType=json`;

        console.log(`Fetching from ${url}...`);

        const response = await fetch(url);

        console.log('Response Status:', response.status);

        if (!response.ok) {
            const text = await response.text();
            console.error('Error Body:', text);
            return;
        }

        const data = await response.json();
        console.log('Response Data:', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

fetchData();
