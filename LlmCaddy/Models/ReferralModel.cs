using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LlmCaddy.Models
{

    [Table("ReferralCommissions")]
    public class ReferralCommission
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid ReferralId { get; set; } // Link to the Referral relationship

        [Required]
        public string InfluencerId { get; set; } = string.Empty; // User ID of the Influencer

        public string? StripeInvoiceId { get; set; } // Set after payment success

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; } = 10.00m;

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Pending"; // Pending, Paid, Failed, Cancelled

        private DateTime _createdAt = DateTime.UtcNow;
        public DateTime CreatedAt
        {
            get => _createdAt;
            set => _createdAt = DateTime.SpecifyKind(value, DateTimeKind.Utc);
        }

        // Navigation Properties
        [ForeignKey("ReferralId")]
        public virtual ReferralModel? Referral { get; set; }

        [ForeignKey("InfluencerId")]
        public virtual ApplicationUser? Influencer { get; set; }
    }


    [Table("Referrals")]
    public class ReferralModel
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public string ReferrerId { get; set; } = string.Empty; // The Influencer (FK to Users)

        [Required]
        public string ReferredUserId { get; set; } = string.Empty; // The New User (FK to Users)

        [Column(TypeName = "decimal(18,2)")]
        public decimal CreditBalance { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalBalance { get; set; } = 0m;

        public string? InvoiceId { get; set; } // Nullable to match the SQL "text" (can be null if pending)

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Pending"; // Pending, Paid, Cancelled

        private DateTime _createdAt = DateTime.UtcNow;

        [Required]
        public DateTime CreatedAt
        {
            get => _createdAt;
            // Ensures PostgreSQL doesn't throw "Kind=Unspecified" errors
            set => _createdAt = DateTime.SpecifyKind(value, DateTimeKind.Utc);
        }

        // Navigation Properties (Optional, but helpful for EF Core joins)
        [ForeignKey("ReferrerId")]
        public virtual ApplicationUser? Referrer { get; set; }

        [ForeignKey("ReferredUserId")]
        public virtual ApplicationUser? ReferredUser { get; set; }
    }

    public class InfluencerCommissionViewModel
    {
        public List<ReferralCommission> Commissions { get; set; } = new();
        public decimal TotalEarned => Commissions.Where(c => c.Status == "Paid").Sum(c => c.Amount);
        public int PaidCount => Commissions.Count(c => c.Status == "Paid");
    }
}