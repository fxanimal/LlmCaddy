using System.Collections.Generic;

namespace LlmCaddy.Models
{
    public class DashboardViewModel
    {
        /// <summary>
        /// Gets or sets the list of active user accounts retrieved from the AspNetUsers table.
        /// </summary>
        public List<ApplicationUser> Users { get; set; } = new();

        /// <summary>
        /// Gets or sets the list of dynamic custom LLM endpoints from the CustomProviders table.
        /// </summary>
        public List<CustomProvider> CustomProviders { get; set; } = new();

        /// <summary>
        /// Gets or sets the global proxy configuration value.
        /// 0 = Pure JS Proxy (Browser-side)
        /// 1 = Managed Server Proxy (Server-side)
        /// </summary>
        public int GlobalRoutingMode { get; set; }

        /// <summary>
        /// A high-performance lookup dictionary mapping user permissions.
        /// Key format: "{UserId}_{ProviderKey}" (e.g., "usr_123_ChatGPT" or "usr_123_custom-provider-uuid")
        /// Value: true if permitted/enabled, false if denied/disabled.
        /// </summary>
        public Dictionary<string, bool> PermissionsLookup { get; set; } = new();
    }
}
