using Microsoft.AspNetCore.Authentication;
using System.ComponentModel.DataAnnotations;

namespace LlmCaddy.Models
{
    public class RegisterModel
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; }

        [Required]
        [StringLength(100, ErrorMessage = "Password must be at least {2} characters long.", MinimumLength = 6)]
        [DataType(DataType.Password)]
        public string Password { get; set; }

        [DataType(DataType.Password)]
        [Compare("Password", ErrorMessage = "Passwords do not match.")]
        public string ConfirmPassword { get; set; }
        public string ReturnUrl { get; set; } = "/";

        public IList<AuthenticationScheme>? ExternalLogins { get; set; } = new List<AuthenticationScheme>();
    }
}
