namespace LlmCaddy.Models
{
    public static class LlmEndpoints
    {
        // Existing Array Base
        public static readonly string[] StrLLMEndpoints =
        {
        "https://api.openai.com/v1",
        "https://api.deepseek.com",
        "https://api.groq.com/openai/v1",
        "https://api.together.xyz/v1",
        "https://api.fireworks.ai/inference/v1",
        "https://openrouter.ai/api/v1",
        "https://api.mistral.ai/v1",
        "https://api.perplexity.ai",
        "https://api-inference.huggingface.co/v1",
        "https://api.anthropic.com/v1",                 // Anthropic Added
        "https://generativelanguage.googleapis.com/v1beta", // Google Gemini Added
        "https://api.cohere.ai/v1"                      // Cohere Added
    };

        // Routing resolver map coordinates
        public static (string Endpoint, string DefaultModel, bool IsOpenAiCompatible) GetRoutingTargets(string provider) =>
            provider.ToLower() switch
            {
                "openai" => (StrLLMEndpoints[0], "gpt-4o-mini", true),
                "deepseek" => (StrLLMEndpoints[1], "deepseek-chat", true),
                "groq" => (StrLLMEndpoints[2], "llama3-8b-8192", true),
                "together" => (StrLLMEndpoints[3], "meta-llama/Llama-3-70b-chat-hf", true),
                "fireworks" => (StrLLMEndpoints[4], "accounts/fireworks/models/llama-v3-70b-instruct", true),
                "openrouter" => (StrLLMEndpoints[5], "microsoft/phi-3-medium-128k-instruct", true),
                "mistral" => (StrLLMEndpoints[6], "open-mixtral-8x22b", true),
                "perplexity" => (StrLLMEndpoints[7], "sonar-reasoning-medium", true),
                "huggingface" => (StrLLMEndpoints[8], "meta-llama/Meta-Llama-3-8B-Instruct", true),
                "anthropic" => (StrLLMEndpoints[9], "claude-3-5-haiku-latest", false),
                "google" => (StrLLMEndpoints[10], "gemini-1.5-flash", false),
                "cohere" => (StrLLMEndpoints[11], "command-r-plus", false),
                _ => (StrLLMEndpoints[0], "gpt-4o-mini", true) // Default fallback
            };
    }
}
