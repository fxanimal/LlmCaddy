using LlmCaddy.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using LlmCaddy.Data;
using Microsoft.EntityFrameworkCore;

namespace LlmCaddy.Service
{

    public static class IdentityDataSeeder
    {
        public static async Task SeedRolesAndAdminAsync(IServiceProvider serviceProvider, IConfiguration config)
        {
            // Get your DbContext instance safely from the startup provider scope
            var context = serviceProvider.GetRequiredService<ApplicationDbContext>();

            var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();
            var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();

            // ====================================================================
            // 1. SEED GLOBAL ROUTING MODE CONFIGURATION
            // ====================================================================
            string routingKey = "GlobalRoutingMode";

            // Check if the setting row already exists in PostgreSQL
            var existingSetting = await context.SystemSettings.FirstOrDefaultAsync(s => s.Key == routingKey);

            if (existingSetting == null)
            {
                Console.WriteLine($">>>> [SEEDER] '{routingKey}' not found. Seeding default value '0' (Pure JS Proxy)...");

                var defaultSetting = new SystemSetting
                {
                    Key = routingKey,
                    Value = "0", // 0 = Pure JS Proxy default fallback choice
                    UpdatedAt = DateTime.UtcNow
                };

                context.SystemSettings.Add(defaultSetting);
                await context.SaveChangesAsync();

                Console.WriteLine(">>>> [SEEDER] GlobalRoutingMode successfully initialized in database.");
            }
            else
            {
                Console.WriteLine($">>>> [SEEDER] GlobalRoutingMode already configured in database. Value: {existingSetting.Value}");
            }

            // ====================================================================
            // 2. SEED ROLES AND ADMIN USER (Your existing code)
            // ====================================================================
            string[] roleNames = { "Administrator", "User" };
            foreach (var roleName in roleNames)
            {
                var roleExist = await roleManager.RoleExistsAsync(roleName);
                if (!roleExist)
                {
                    await roleManager.CreateAsync(new IdentityRole(roleName));
                }
            }

            string adminUsername = "admin";
            var adminUser = await userManager.FindByNameAsync(adminUsername);

            if (adminUser == null)
            {
                var newAdmin = new ApplicationUser
                {
                    UserName = adminUsername,
                    Email = "hello@llmcaddy.com",
                    EmailConfirmed = true,
                    FirstName = "System",
                    LastName = "Admin",
                    AccountCreated = DateTime.UtcNow
                };

                string adminPassword = config["LLMCADDY_ADMIN_PASSWORD"]
                                    ?? config["DefaultAdminSettings:Password"]
                                    ?? "DevDefaultPassword123!";

                var createAdminResult = await userManager.CreateAsync(newAdmin, adminPassword);
                if (createAdminResult.Succeeded)
                {
                    await userManager.AddToRoleAsync(newAdmin, "Administrator");
                    Console.WriteLine(">>>> [SEEDER] Admin user successfully seeded.");
                }
            }
        }
    }
}