namespace LlmCaddy.Service
{
    public static class SmartRouter
    {
        public static string ClassifyIntent(string prompt)
        {
            var lowerPrompt = prompt.ToLower();

            // Complex algorithms, systems architecture, debugging logic -> Anthropic
            if (lowerPrompt.Contains("architecture") || lowerPrompt.Contains("algorithm") ||
                lowerPrompt.Contains("refactor") || lowerPrompt.Contains("optimize code"))
            {
                return "anthropic";
            }

            // Long text formatting, translations, writing, document generation -> Cohere
            if (lowerPrompt.Contains("translate") || lowerPrompt.Contains("essay") ||
                lowerPrompt.Contains("write an article") || lowerPrompt.Contains("copywriting"))
            {
                return "cohere";
            }

            // High volume data sorting, structural synthesis, math calculations -> Google Gemini
            if (lowerPrompt.Contains("calculate") || lowerPrompt.Contains("analyze data") ||
                lowerPrompt.Contains("statistics") || lowerPrompt.Contains("csv"))
            {
                return "google";
            }

            // Code generation tasks -> DeepSeek
            if (lowerPrompt.Contains("code") || lowerPrompt.Contains("function") || lowerPrompt.Contains("sql"))
            {
                return "deepseek";
            }

            // Real-time research indexing requests -> Perplexity
            if (lowerPrompt.Contains("latest") || lowerPrompt.Contains("news") || lowerPrompt.Contains("current price"))
            {
                return "perplexity";
            }

            // Default General Processing -> OpenAI
            return "openai";
        }
    }
}