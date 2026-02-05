// Using native fetch (Node 18+)

async function testApi() {
    try {
        console.log("Fetching from http://localhost:3000/api/recycle?q=피자박스");
        // Use global fetch if node-fetch is not found (Node 18+)
        const res = await fetch('http://localhost:3000/api/recycle?q=피자박스');
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Body length:", text.length);
        console.log("Body preview:", text.substring(0, 500));

        try {
            const json = JSON.parse(text);
            console.log("JSON parsed successfully:", JSON.stringify(json, null, 2).substring(0, 500));
        } catch (e) {
            console.log("Failed to parse JSON");
        }
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

testApi();
