using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LlmCaddy.Models
{
    public class ChatLog
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        public string Prompt { get; set; } = null!;
        public string Response { get; set; } = null!;

        // PostgreSQL uses DateTime (mapping to timestamptz or timestamp)
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        // Maps your embedding field
        public string? Embedding { get; set; }
    }

    public class DocumentChunk
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        public string Filename { get; set; } = null!;
        public int ChunkIndex { get; set; }
        public string Content { get; set; } = null!;
        public string Embedding { get; set; } = null!;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class CustomProvider
    {
        [Key]
        public string Id { get; set; } = null!;
        public string DisplayName { get; set; } = null!;
        public string BaseUrl { get; set; } = null!;
        public string DefaultModel { get; set; } = null!;
    }

    public class SystemSetting
    {
        [Key]
        public string Key { get; set; } = null!;
        public string Value { get; set; } = null!;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class UserLlmPermission
    {
        public string UserId { get; set; } = null!;
        public string ProviderKey { get; set; } = null!;
        public bool IsEnabled { get; set; } = true;
    }

    public class ApplicationUser : IdentityUser
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public DateTime AccountCreated { get; set; } = DateTime.UtcNow;
    }
}
