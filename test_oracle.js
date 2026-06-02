const endpoint = "http://127.0.0.1:1234/v1/chat/completions";

async function pingOracle() {
    console.log("Igniting connection to the Native Oracle (Qwen) on port 1234...");
    
    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "qwen/qwen3.5-9b",
                messages: [
                    { role: "system", content: "You are the Hearth Native Oracle. Respond with a single short, solarpunk sentence." },
                    { role: "user", content: "Are you awake?" }
                ],
                temperature: 0.7,
                max_tokens: 50
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("\n--- ORACLE RESPONSE ---");
        console.log(data.choices[0].message.content);
        console.log("-----------------------\n");
        console.log("The Hearthlands are officially sovereign.");
    } catch (error) {
        console.error("Connection failed. Is the server running?", error.message);
    }
}

pingOracle();
