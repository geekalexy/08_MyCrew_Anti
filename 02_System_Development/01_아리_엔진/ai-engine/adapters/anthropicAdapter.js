import Anthropic from '@anthropic-ai/sdk';

class AnthropicAdapter {
    constructor() {
        if (!process.env.ANTHROPIC_API_KEY) {
            console.warn("⚠️ ANTHROPIC_API_KEY가 등록되지 않았습니다.");
        }
        // Initialize the Anthropic client
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    async generateResponse(systemPrompt, userPrompt) {
        try {
            console.log(`[Anthropic Adapter] 클로드 3.5 Sonnet 실행 중...`);
            const response = await this.client.messages.create({
                model: "claude-3-5-sonnet-latest",
                max_tokens: 4096,
                system: systemPrompt,
                messages: [
                    { role: "user", content: userPrompt }
                ],
            });

            return response.content[0].text;
        } catch (error) {
            console.error('[Anthropic Adapter] 오류 발생:', error);
            throw new Error(`Claude 오류: ${error.message}`);
        }
    }
}

export default new AnthropicAdapter();
