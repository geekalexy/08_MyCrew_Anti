import Anthropic from '@anthropic-ai/sdk';
import keyProvider from '../tools/keyProvider.js';

class AnthropicAdapter {
    constructor() {
        this.client = null;
    }

    async _ensureClient() {
        if (this.client) return;

        const apiKey = await keyProvider.getKey('ANTHROPIC_API_KEY');
        if (apiKey) {
            this.client = new Anthropic({ apiKey });
        } else {
            console.warn("⚠️ [AnthropicAdapter] ANTHROPIC_API_KEY가 등록되지 않았습니다.");
        }
    }

    async generateResponse(systemPrompt, userPrompt, model = "claude-4-6-sonnet") {
        try {
            await this._ensureClient();
            if (!this.client) throw new Error("ANTHROPIC_API_KEY를 찾을 수 없습니다.");

            console.log(`[Anthropic Adapter] ${model} 실행 중...`);
            const response = await this.client.messages.create({
                model: model,
                max_tokens: 4096,
                system: systemPrompt,
                messages: [
                    { role: "user", content: userPrompt }
                ],
            });

            return {
                text: response.content[0].text,
                tokenUsage: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
            };
        } catch (error) {
            console.error('[Anthropic Adapter] 오류 발생:', error);
            throw new Error(`Claude 오류: ${error.message}`);
        }
    }
}

export default new AnthropicAdapter();
