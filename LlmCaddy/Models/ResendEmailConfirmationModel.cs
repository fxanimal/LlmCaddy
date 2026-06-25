using System.ComponentModel.DataAnnotations;

namespace LlmCaddy.Models
{
    public class ResendEmailConfirmationModel
    {
        public InputModel Input { get; set; }

        public string StatusMessage { get; set; }

        public class InputModel
        {
            [Required]
            [EmailAddress]
            [Display(Name = "Email")]
            public string Email { get; set; }
        }
    }
}
