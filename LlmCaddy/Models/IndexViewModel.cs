using System.Collections.Generic;

namespace LlmCaddy.Models
{
    public class IndexViewModel
    {
        // IDs of the standard core providers allowed (e.g. "openai", "anthropic")
        public HashSet<string> PermittedProviderIds { get; set; } = new HashSet<string>();

        // Custom endpoints permitted for this user
        public List<CustomProviderDto> PermittedCustomProviders { get; set; } = new List<CustomProviderDto>();
    }

    public class CustomProviderDto
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Url { get; set; }
        public string Model { get; set; }
    }
}