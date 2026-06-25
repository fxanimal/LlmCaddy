using LlmCaddy.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace LlmCaddy.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser, IdentityRole, string>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<ChatLog> ChatLogs { get; set; } = null!;
    public DbSet<DocumentChunk> DocumentChunks { get; set; } = null!;
    public DbSet<CustomProvider> CustomProviders { get; set; } = null!;
    public DbSet<SystemSetting> SystemSettings { get; set; }
    public DbSet<UserLlmPermission> UserLlmPermissions { get; set; }
    public DbSet<AnonymousProxyBackup> AnonymousProxyBackups { get; set; }
    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Absolute must for Identity configuration mechanics
        base.OnModelCreating(builder);

        builder.Entity<ChatLog>()
            .Property(b => b.Timestamp)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.Entity<DocumentChunk>()
            .Property(b => b.Timestamp)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.Entity<UserLlmPermission>()
            .HasKey(p => new { p.UserId, p.ProviderKey });

        builder.Entity<SystemSetting>().ToTable("SystemSettings");
        builder.Entity<UserLlmPermission>().ToTable("UserLlmPermissions");
        builder.Entity<CustomProvider>().ToTable("CustomProviders");
        builder.Entity<AnonymousProxyBackup>(entity =>
        {
            entity.HasIndex(e => e.ProxyClientId).IsUnique();
        });
    }
}