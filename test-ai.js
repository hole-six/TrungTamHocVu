import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
    baseURL: "https://fpt.nce.vn/v1",
    apiKey: process.env.PORTAL_LLM_KEY
});

async function main() {

    const res = await client.chat.completions.create({
        model: "claude-sonnet-5",
        messages: [
            {
                role: "user",
                content: "Xin chào"
            }
        ]
    });

    console.log(res.choices[0].message.content);

}

main();