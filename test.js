import AnthropicAws from "@anthropic-ai/aws-sdk";

// The SDK automatically reads ANTHROPIC_AWS_API_KEY, 
// ANTHROPIC_AWS_WORKSPACE_ID, and AWS_REGION from your environment.
const client = new AnthropicAws();

async function run() {
    try {
        const message = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            messages: [{ role: "user", content: "Hello from the Node app!" }],
        });

        console.log("--- Response Received ---");
        console.log(message.content[0].text);
    } catch (error) {
        console.error("Connection or API Error:", error);
    }
}

run();