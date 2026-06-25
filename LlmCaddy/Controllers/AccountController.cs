using LlmCaddy.Data;
using LlmCaddy.Models;
using System.Security.Claims;
using LlmCaddy.Service;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Diagnostics;
using System.Text;
using System.Text.Encodings.Web;

namespace LlmCaddy.Controllers
{
    public record RoutingUpdateDto(int Mode);

    public record PermissionUpdateDto(
        string UserId,
        string ProviderKey,
        bool IsEnabled
    );

    public class UserBackup
    {
        public int Id { get; set; }
        public string TrackingKey { get; set; } // Can store either Client UUID string or Auth NameIdentifier
        public byte[] BinaryData { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsServerManagedMode { get; set; }
    }

    [Authorize] 
    public class AccountController : Controller
    {
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<AccountController> _logger;
        private readonly IConfiguration _config;
        private readonly ApplicationDbContext _dbContext;

        public AccountController(SignInManager<ApplicationUser> signInManager, UserManager<ApplicationUser> userManager, 
            ApplicationDbContext dbContext, ILogger<AccountController> logger, IConfiguration config)
        {
            _signInManager = signInManager; _userManager = userManager; _logger = logger; 
            _config = config; _dbContext = dbContext; 
        }

        [AllowAnonymous]
        [HttpGet("/account/login")]
        public async Task<IActionResult> Login(string returnUrl = "/")
        {
            await HttpContext.SignOutAsync(IdentityConstants.ExternalScheme);
            var model = new LoginViewModel
            {
                ReturnUrl = returnUrl,
            };
            ViewBag.Domainname = HttpContext.Request.Host.ToString();
            return View("/Views/Account/Login.cshtml", model);
        }

        [HttpPost("/account/login")]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(LoginViewModel model)
        {
            if (!ModelState.IsValid)
                return View("/Views/Account/Login.cshtml", model);

            ApplicationUser? user = null;

            if (model.Input.Contains('@'))
            {
                user = await _userManager.FindByEmailAsync(model.Input);
            }
            else
            {
                user = await _userManager.FindByNameAsync(model.Input);
            }

            if (user != null)
            {
                var result = await _signInManager.PasswordSignInAsync(user, model.Password, model.RememberMe, lockoutOnFailure: false);

                if (result.Succeeded)
                {
                    _logger.LogInformation("User logged in: {Identity}", user.UserName);

                    string? targetUrl = Request.Cookies["llmcaddyReturnUrl"];
                    if (!string.IsNullOrEmpty(targetUrl) && Url.IsLocalUrl(targetUrl))
                    {
                        Response.Cookies.Delete("llmcaddyReturnUrl");
                        return LocalRedirect(targetUrl);
                    }

                    if (await _userManager.IsInRoleAsync(user, "Administrator"))
                    {
                        return RedirectToAction("Dashboard", "Account");
                    }
                    return RedirectToAction("Index", "Chat");
                }
                else if (result.IsLockedOut)
                {
                    _logger.LogWarning("User account locked out: {Identity}", model.Input);
                    ModelState.AddModelError("", "Your account is locked.");
                    return View("/Views/Account/Login.cshtml", model);
                }
                else if (result.RequiresTwoFactor)
                {
                    return RedirectToAction("LoginWith2fa", new { RememberMe = model.RememberMe });
                }
            }

            ModelState.AddModelError("", "Invalid login attempt.");
            return View("/Views/Account/Login.cshtml", model);
        }

        // Logout Action
        [HttpPost("/account/logout")]
        [ValidateAntiForgeryToken] // Prevents CSRF attacks
        public async Task<IActionResult> Logout(string returnUrl = null)
        {
            ViewBag.Domainname = HttpContext.Request.Host.ToString();
            await _signInManager.SignOutAsync();

            if (returnUrl != null)
            {
                return LocalRedirect(returnUrl);
            }
            else
            {
                return RedirectToAction("Index", "Home");
            }
        }

        [HttpPost]
        [Authorize(Roles = "Administrator")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> AdminChangePassword(string oldPassword, string newPassword, string confirmPassword)
        {
            if (newPassword != confirmPassword)
            {
                TempData["Error"] = "New passwords do not match.";
                return RedirectToAction("Dashboard");
            }

            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Challenge();

            var result = await _userManager.ChangePasswordAsync(user, oldPassword, newPassword);
            if (result.Succeeded)
            {
                TempData["Success"] = "Your administrator password has been successfully updated.";
            }
            else
            {
                TempData["Error"] = string.Join(" ", result.Errors.Select(e => e.Description));
            }

            return RedirectToAction("Dashboard");
        }

        [HttpPost]
        [Authorize(Roles = "Administrator")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> AdminCreateUser(string username, string password)
        {
            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            {
                TempData["Error"] = "Username and password cannot be empty.";
                return RedirectToAction("Dashboard");
            }

            var newAdminCreatedUser = new ApplicationUser
            {
                UserName = username,
                Email = $"{username}@llmcaddy.local", // Placeholder local email assignment
                EmailConfirmed = true,
                FirstName = "Provisioned",
                LastName = "User",
                AccountCreated = DateTime.UtcNow
            };

            var result = await _userManager.CreateAsync(newAdminCreatedUser, password);
            if (result.Succeeded)
            {
                // Assign them the default User role tier
                await _userManager.AddToRoleAsync(newAdminCreatedUser, "User");
                TempData["Success"] = $"User '{username}' successfully created and added to database.";
            }
            else
            {
                TempData["Error"] = string.Join(" ", result.Errors.Select(e => e.Description));
            }

            return RedirectToAction("Dashboard");
        }

        [HttpPost]
        [Authorize(Roles = "Administrator")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateGlobalRouting([FromBody] RoutingUpdateDto dto)
        {
            if (dto == null || (dto.Mode != 0 && dto.Mode != 1))
            {
                return BadRequest(new { success = false, message = "Invalid routing mode provided." });
            }

            try
            {
                // 1. Locate the existing configuration record in your Postgres table
                var setting = await _dbContext.SystemSettings
                    .FirstOrDefaultAsync(s => s.Key == "GlobalRoutingMode");

                if (setting == null)
                {
                    // 2. Fallback creation if the row somehow got deleted
                    setting = new SystemSetting
                    {
                        Key = "GlobalRoutingMode",
                        Value = dto.Mode.ToString(),
                        UpdatedAt = DateTime.UtcNow
                    };
                    _dbContext.SystemSettings.Add(setting);
                }
                else
                {
                    // 3. Update the existing state profile record on the fly
                    setting.Value = dto.Mode.ToString();
                    setting.UpdatedAt = DateTime.UtcNow;
                    _dbContext.SystemSettings.Update(setting);
                }

                // 4. Commit changes to your database asynchronously
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = "Global routing engine updated successfully." });
            }
            catch (Exception ex)
            {
                // Log the error via your internal ILogger architecture if needed
                return StatusCode(500, new { success = false, message = "An internal database error occurred." });
            }
        }

        [HttpPost]
        [Authorize(Roles = "Administrator")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateUserPermission([FromBody] PermissionUpdateDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.UserId) || string.IsNullOrWhiteSpace(dto.ProviderKey))
            {
                return BadRequest(new { success = false, message = "Invalid matrix parameters." });
            }

            try
            {
                // Search for an existing restriction/exclusion row
                var permission = await _dbContext.UserLlmPermissions
                    .FirstOrDefaultAsync(p => p.UserId == dto.UserId && p.ProviderKey == dto.ProviderKey);

                if (!dto.IsEnabled)
                {
                    // Revoked (false): Ensure a restriction record exists in the database
                    if (permission == null)
                    {
                        permission = new UserLlmPermission
                        {
                            UserId = dto.UserId,
                            ProviderKey = dto.ProviderKey,
                            IsEnabled = false // Logged as false (unpermitted)
                        };
                        _dbContext.UserLlmPermissions.Add(permission);
                    }
                    else
                    {
                        permission.IsEnabled = false;
                        _dbContext.UserLlmPermissions.Update(permission);
                    }
                }
                else
                {
                    // Permitted (true): Remove the restriction record entirely to default to true
                    if (permission != null)
                    {
                        _dbContext.UserLlmPermissions.Remove(permission);
                    }
                }

                await _dbContext.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (Exception)
            {
                return StatusCode(500, new { success = false, message = "Database mapping exception encountered." });
            }
        }
        
        [HttpGet("/account/dashboard")]
        [Authorize(Roles = "Administrator")]
        public async Task<IActionResult> Dashboard()
        {
            // 1. Fetch Global Routing Mode Setting (Fallback to 0 if table row is missing)
            var routingSetting = await _dbContext.SystemSettings
                .FirstOrDefaultAsync(s => s.Key == "GlobalRoutingMode");
            int routingMode = routingSetting != null ? int.Parse(routingSetting.Value) : 0;

            // 2. Query all application users and custom SQL-defined endpoints
            var users = await _userManager.Users.ToListAsync();
            var customProviders = await _dbContext.CustomProviders.ToListAsync();

            // 3. Fetch all custom permission flags into memory
            //var permissions = await _dbContext.UserLlmPermissions.ToListAsync();
            // 3. Fetch explicit configuration flags from memory
            var permissions = await _dbContext.UserLlmPermissions.ToListAsync();

            // 4. Construct the dictionary lookup 
            // Since rows mean "Unpermitted", if a row exists with IsEnabled == false, it maps to false.
            var permissionsLookup = permissions.ToDictionary(
                p => $"{p.UserId}_{p.ProviderKey}",
                p => p.IsEnabled // Keeps the false flag intact
            );

            // 5. Populate your DashboardViewModel container
            var viewModel = new DashboardViewModel
            {
                Users = users,
                CustomProviders = customProviders,
                GlobalRoutingMode = routingMode,
                PermissionsLookup = permissionsLookup
            };

            // 6. Return the typed model directly to your view path
            return View("/Views/Account/Dashboard.cshtml", viewModel);
        }

        [HttpGet("/account/SyncAnonymousProxy")]
        [AllowAnonymous]
        public async Task<IActionResult> DownloadAnonymousBackup([FromQuery] string clientId)
        {
            if (string.IsNullOrWhiteSpace(clientId))
            {
                return BadRequest("Identity lookup key parameter is missing.");
            }
            string searchKey = clientId.Trim().ToLower();
            var backup = await _dbContext.AnonymousProxyBackups.FirstOrDefaultAsync(b => b.ProxyClientId == searchKey || b.MnemonicPhrase == searchKey);
            if (backup == null || backup.SqliteBackupBlob == null || backup.SqliteBackupBlob.Length == 0)
            {
                return StatusCode(204);
            }
            Response.Headers.Append("X-Returned-Client-Id", backup.ProxyClientId);
            return File(backup.SqliteBackupBlob, "application/octet-stream", $"proxy_{backup.ProxyClientId}.db");
        }

        private IActionResult Zuckerberg204NoContent() => StatusCode(204);

        [HttpPost("/account/SyncAnonymousProxy")]
        [AllowAnonymous]
        [DisableRequestSizeLimit]
        public async Task<IActionResult> UploadAnonymousBackup([FromQuery] string clientId)
        {
            if (string.IsNullOrWhiteSpace(clientId))
            {
                return BadRequest("Client tracking query parameter identity token is missing.");
            }

            string searchKey = clientId.Trim().ToLower();

            // 1. Read the raw compressed Gzip binary payload array straight out of the HTTP request stream body
            byte[] compressedSqliteBinary;
            using (var memoryStream = new MemoryStream())
            {
                await Request.Body.CopyToAsync(memoryStream);
                compressedSqliteBinary = memoryStream.ToArray();
            }

            if (compressedSqliteBinary == null || compressedSqliteBinary.Length == 0)
            {
                return BadRequest("Invalid processing payload: Incoming upload byte transmission array was empty.");
            }

            try
            {
                // 2. Perform safe tracking lookup to determine if this is an INSERT or an UPDATE operation (Upsert)
                var existingBackup = await _dbContext.AnonymousProxyBackups
                    .FirstOrDefaultAsync(b => b.ProxyClientId == searchKey || b.MnemonicPhrase == searchKey);

                if (existingBackup != null)
                {
                    // 🌟 FIXES THE 500 CRASH: If record exists, update ONLY the data blob and synchronization timestamp.
                    // This keeps the existing MnemonicPhrase intact and completely bypasses primary/unique key constraint faults.
                    existingBackup.SqliteBackupBlob = compressedSqliteBinary;
                    existingBackup.LastSyncTime = DateTime.UtcNow;

                    _dbContext.AnonymousProxyBackups.Update(existingBackup);
                }
                else
                {
                    // If this is a completely brand new client profile entry context, parse header flags if present
                    string mnemonicPhraseHeader = Request.Headers["X-Proxy-Mnemonic-Phrase"].ToString();

                    var newBackup = new AnonymousProxyBackup // Replace with your actual entity class name
                    {
                        ProxyClientId = searchKey,
                        MnemonicPhrase = !string.IsNullOrWhiteSpace(mnemonicPhraseHeader) ? mnemonicPhraseHeader.Trim().ToLower() : searchKey,
                        SqliteBackupBlob = compressedSqliteBinary,
                        LastSyncTime = DateTime.UtcNow
                    };

                    await _dbContext.AnonymousProxyBackups.AddAsync(newBackup);
                }

                // 3. Commit tracking changes securely to the PostgreSQL instance context
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                // Logs out deep-seated entity layout constraint errors directly into the IDE output logging terminal
                Console.WriteLine($"❌ [CRITICAL BACKPLANE SYNC EXCEPTION]: {ex.Message}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"⚠️ [Inner Exception]: {ex.InnerException.Message}");
                }
                return StatusCode(500, "An unhandled tracking transaction fault occurred on the persistence layer.");
            }
        }
        private string ConvertUuidToMnemonic(string uuid)
        {
            if (string.IsNullOrWhiteSpace(uuid)) return "unknown-device-phrase";

            string[] adjectives =
            {
                "ancient", "atomic", "bionic", "bitter", "blank", "blazing", "blind", "bold", "brave", "breezy",
                "bright", "bronze", "calm", "clever", "cold", "cosmic", "crazy", "crisp", "crypto", "cyan",
                "daring", "dark", "dawn", "decent", "deep", "dense", "divine", "dry", "eager", "early",
                "elastic", "electric", "elegant", "epic", "eternal", "exotic", "fancy", "fast", "fatal", "fierce",
                "final", "first", "flashy", "flat", "flying", "formal", "fresh", "frosty", "frozen", "gentle",
                "giant", "glamorous", "global", "golden", "grand", "gray", "great", "green", "grim", "heavy",
                "hidden", "hollow", "holy", "honest", "huge", "humble", "hyper", "icy", "infinite", "inner",
                "ionic", "iron", "jolly", "jungle", "keen", "kinetic", "light", "linear", "liquid", "lively",
                "local", "lone", "lucky", "lunar", "magic", "magnetic", "mega", "mellow", "modern", "mystic",
                "native", "natural", "neon", "neutral", "new", "noble", "nomad", "nordic", "odd", "silent"
            };

            string[] colors =
            {
                "amber", "apricot", "aqua", "avocado", "azure", "banana", "beige", "berry", "black", "blue",
                "blush", "bone", "brass", "brick", "bronze", "brown", "bubblegum", "burgundy", "butter", "camel",
                "canary", "caramel", "charcoal", "cherry", "chestnut", "chocolate", "citron", "clover", "cobalt", "cocoa",
                "copper", "coral", "cornflower", "cream", "crimson", "denim", "desert", "emerald", "espresso", "fern",
                "firebrick", "flax", "forest", "fuchsia", "ginger", "gold", "grape", "graphite", "gray", "green",
                "hazel", "heather", "honey", "hotpink", "indigo", "ink", "iris", "ivory", "jade", "jasmine",
                "khaki", "lavender", "lemon", "lilac", "lime", "magenta", "mahogany", "mango", "maroon", "mauve",
                "mint", "moss", "mustard", "navy", "oatmeal", "ochre", "olive", "onyx", "opal", "orange",
                "orchid", "peach", "pear", "pearl", "periwinkle", "pewter", "pink", "plum", "pumpkin", "purple",
                "ruby", "salmon", "sapphire", "scarlet", "silver", "tan", "teal", "tomato", "violet", "white"
            };

            string[] nouns =
            {
                "anchor", "apple", "arrow", "astronaut", "atlas", "avalanche", "badger", "beacon", "bear", "beetle",
                "bison", "blade", "boulder", "breeze", "camel", "canyon", "castle", "cheetah", "cliff", "cloud",
                "comet", "compass", "condor", "crater", "crystal", "cyborg", "dolphin", "dragon", "eagle", "earth",
                "echo", "eclipse", "engine", "falcon", "fender", "forest", "fossil", "fox", "galaxy", "glacier",
                "glitch", "grizzly", "hammer", "hawk", "horizon", "hurricane", "island", "jaguar", "jungle", "jupiter",
                "koala", "laser", "leopard", "lion", "lizard", "locust", "magma", "magnet", "mammoth", "mantis",
                "matrix", "meteor", "mirror", "monkey", "moon", "mountain", "nebula", "neuron", "ocean", "orbit",
                "panther", "penguin", "phoenix", "photon", "pilot", "pixel", "planet", "prism", "pulsar", "python",
                "quantum", "quasar", "radar", "raven", "river", "robot", "rocket", "rover", "satellite", "scout",
                "shadow", "shark", "shield", "sonic", "spark", "sphere", "sphinx", "star", "storm", "vortex"
            };

            // Cyrb128 implementation in C#
            uint h1 = 1779033703, h2 = 3024733165, h3 = 3362453659, h4 = 502494819;
            foreach (char c in uuid)
            {
                uint k = (uint)c;
                h1 = h2 ^ (h1 ^ k) * 597399067;
                h2 = h3 ^ (h2 ^ k) * 2869860233;
                h3 = h4 ^ (h3 ^ k) * 951274213;
                h4 = h1 ^ (h4 ^ k) * 2716044179;
            }
            h1 = (h3 ^ (h1 >> 18)) * 597399067;
            h2 = (h4 ^ (h2 >> 22)) * 2869860233;
            h3 = (h1 ^ (h3 >> 17)) * 951274213;
            h4 = (h2 ^ (h4 >> 19)) * 2716044179;

            uint hash1 = h1 ^ h2 ^ h3 ^ h4;
            uint hash2 = h2 ^ h1;
            uint hash3 = h3 ^ h1;

            int adjIndex = (int)(hash1 % (uint)adjectives.Length);
            int colorIndex = (int)(hash2 % (uint)colors.Length);
            int nounIndex = (int)(hash3 % (uint)nouns.Length);

            return $"{adjectives[adjIndex]}-{colors[colorIndex]}-${nouns[nounIndex]}".ToLower();
        }

        [HttpGet("/account/SyncServerManaged")]
        public async Task<IActionResult> DownloadServerManagedBackup()
        {
            string searchKey = Request.Headers["X-Proxy-Client-Id"].ToString();
            if (string.IsNullOrWhiteSpace(searchKey))
            {
                searchKey = User.FindFirstValue(ClaimTypes.NameIdentifier);
            }
            if (string.IsNullOrWhiteSpace(searchKey)) return Unauthorized();
            searchKey = searchKey.Trim().ToLower();
            try
            {
                var backup = await _dbContext.AnonymousProxyBackups
                    .FirstOrDefaultAsync(b => b.ProxyClientId.Trim().ToLower() == searchKey);
                if (backup == null || backup.SqliteBackupBlob == null || backup.SqliteBackupBlob.Length == 0)
                {
                    return StatusCode(204);
                }
                return File(backup.SqliteBackupBlob, "application/octet-stream");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CRITICAL DOWNLOAD ERROR]: {ex.Message}");
                return StatusCode(500, new { message = "Error pulling database file context stream." });
            }
        }

        [HttpPost("/account/SyncServerManaged")]
        [DisableRequestSizeLimit]
        [IgnoreAntiforgeryToken]
        public async Task<IActionResult> UploadServerManagedBackup()
        {
            if (Request.ContentLength.HasValue && Request.ContentLength.Value == 0)
            {
                return BadRequest(new { success = false, message = "Cannot synchronize an empty binary payload." });
            }
            string rawId = Request.Headers["X-Proxy-Client-Id"].ToString();
            if (string.IsNullOrWhiteSpace(rawId))
            {
                rawId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            }
            if (string.IsNullOrWhiteSpace(rawId)) return Unauthorized();
            rawId = rawId.Trim().ToLower();
            try
            {
                byte[] compressedSqliteBinary;
                using (var memoryStream = new MemoryStream())
                {
                    await Request.Body.CopyToAsync(memoryStream);
                    compressedSqliteBinary = memoryStream.ToArray();
                }
                if (compressedSqliteBinary.Length == 0)
                {
                    return BadRequest(new { success = false, message = "Payload body stream resolved empty." });
                }

                var existingBackup = await _dbContext.AnonymousProxyBackups
                    .FirstOrDefaultAsync(b => b.ProxyClientId.Trim().ToLower() == rawId);

                if (existingBackup == null)
                {
                    var newBackup = new AnonymousProxyBackup
                    {
                        ProxyClientId = rawId,
                        MnemonicPhrase = $"auth-user-{rawId}",
                        SqliteBackupBlob = compressedSqliteBinary,
                        LastSyncTime = DateTime.UtcNow
                    };
                    await _dbContext.AnonymousProxyBackups.AddAsync(newBackup);
                }
                else
                {
                    existingBackup.SqliteBackupBlob = compressedSqliteBinary;
                    existingBackup.LastSyncTime = DateTime.UtcNow;
                }
                await _dbContext.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CRITICAL SERVER-MANAGED SYNC ERROR]: {ex.Message}");
                return StatusCode(500, new { success = false, message = ex.InnerException?.Message ?? ex.Message });
            }
        }
    }
}
