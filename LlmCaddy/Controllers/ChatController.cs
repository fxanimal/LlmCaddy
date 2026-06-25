using LlmCaddy.Models;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;

namespace LlmCaddy.Controllers
{
    using LlmCaddy.Data;
    using LlmCaddy.Service;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.Data.Sqlite;
    using Microsoft.EntityFrameworkCore;
    using System.Net.Http.Headers;
    using System.Text;
    using System.Text.Json;

    public class ChatController : Controller
    {
        private readonly IHttpClientFactory _clientFactory;
        private readonly ApplicationDbContext _dbContext;


        public ChatController(IHttpClientFactory clientFactory, ApplicationDbContext dbContext)
        {
            _clientFactory = clientFactory; _dbContext = dbContext; 
        }

        [HttpPost]
        public async Task StreamResponse([FromBody] ChatRequest request)
        {
            if (string.IsNullOrEmpty(request.Prompt))
            {
                Response.StatusCode = 400;
                await Response.WriteAsync("Prompt payload is missing.");
                return;
            }

            // Determine destination provider targets via Smart Routing
            string targetProvider = request.Provider;
            if (string.IsNullOrEmpty(targetProvider) || targetProvider.ToLower() == "none")
            {
                targetProvider = SmartRouter.ClassifyIntent(request.Prompt);
            }

            var (baseUrl, activeModel, isOpenAiCompatible) = LlmEndpoints.GetRoutingTargets(targetProvider);

            string targetKey = request.ApiKey ?? Environment.GetEnvironmentVariable($"LLMCADDY_API_KEY_{targetProvider.ToUpper()}");
            if (string.IsNullOrEmpty(targetKey))
            {
                Response.StatusCode = 401;
                await Response.WriteAsync($"Missing configuration credentials for: {targetProvider}");
                return;
            }

            Response.ContentType = "text/plain";
            var client = _clientFactory.CreateClient();
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, "");

            // --- SCHEMATIC GENERATION ROUTING BRANCHES ---

            if (isOpenAiCompatible)
            {
                string url = baseUrl.EndsWith("/") ? $"{baseUrl}chat/completions" : $"{baseUrl}/chat/completions";
                httpRequest.RequestUri = new Uri(url);
                httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", targetKey);

                var payload = new { model = activeModel, messages = new[] { new { role = "user", content = request.Prompt } }, stream = true };
                httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            }
            else if (targetProvider.ToLower() == "anthropic")
            {
                httpRequest.RequestUri = new Uri($"{baseUrl}/messages");
                httpRequest.Headers.Add("x-api-key", targetKey);
                httpRequest.Headers.Add("anthropic-version", "2023-06-01"); // Required Header

                var payload = new { model = activeModel, max_tokens = 2048, messages = new[] { new { role = "user", content = request.Prompt } }, stream = true };
                httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            }
            else if (targetProvider.ToLower() == "google")
            {
                // Gemini uses URL-query parameter key structures instead of dynamic headers
                httpRequest.RequestUri = new Uri($"{baseUrl}/models/{activeModel}:streamGenerateContent?key={targetKey}");

                var payload = new { contents = new[] { new { role = "user", parts = new[] { new { text = request.Prompt } } } } };
                httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            }
            else if (targetProvider.ToLower() == "cohere")
            {
                httpRequest.RequestUri = new Uri($"{baseUrl}/chat");
                httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", targetKey);

                var payload = new { model = activeModel, message = request.Prompt, stream = true };
                httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            }

            // --- RESPONSE HANDLING ENGINE STREAM LOOPS ---

            try
            {
                using var response = await client.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead);
                if (!response.IsSuccessStatusCode)
                {
                    Response.StatusCode = (int)response.StatusCode;
                    return;
                }

                using var responseStream = await response.Content.ReadAsStreamAsync();
                using var reader = new StreamReader(responseStream);

                while (!reader.EndOfStream)
                {
                    var line = await reader.ReadLineAsync();
                    if (string.IsNullOrEmpty(line)) continue;

                    string contentChunk = string.Empty;

                    if (isOpenAiCompatible && line.StartsWith("data: "))
                    {
                        var data = line.Substring(6).Trim();
                        if (data == "[DONE]") break;
                        try
                        {
                            using var doc = JsonDocument.Parse(data);
                            contentChunk = doc.RootElement.GetProperty("choices")[0].GetProperty("delta").GetProperty("content").GetString();
                        }
                        catch { }
                    }
                    else if (targetProvider.ToLower() == "anthropic" && line.StartsWith("data: "))
                    {
                        var data = line.Substring(6).Trim();
                        try
                        {
                            using var doc = JsonDocument.Parse(data);
                            string eventType = doc.RootElement.GetProperty("type").GetString();
                            if (eventType == "content_block_delta")
                            {
                                contentChunk = doc.RootElement.GetProperty("delta").GetProperty("text").GetString();
                            }
                        }
                        catch { }
                    }
                    else if (targetProvider.ToLower() == "google")
                    {
                        // Gemini streams return directly as an array of JSON objects without "data:" prefixes
                        string cleanLine = line.Trim().TrimStart('[').TrimEnd(',').TrimEnd(']');
                        if (string.IsNullOrEmpty(cleanLine)) continue;
                        try
                        {
                            using var doc = JsonDocument.Parse(cleanLine);
                            contentChunk = doc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
                        }
                        catch { }
                    }
                    else if (targetProvider.ToLower() == "cohere")
                    {
                        try
                        {
                            using var doc = JsonDocument.Parse(line);
                            if (doc.RootElement.GetProperty("event_type").GetString() == "text-generation")
                            {
                                contentChunk = doc.RootElement.GetProperty("text").GetString();
                            }
                        }
                        catch { }
                    }

                    if (!string.IsNullOrEmpty(contentChunk))
                    {
                        await Response.WriteAsync(contentChunk);
                        await Response.Body.FlushAsync();
                    }
                }
            }
            catch (Exception ex)
            {
                Response.StatusCode = 500;
                await Response.WriteAsync($"Dynamic Router Exception: {ex.Message}");
            }
        }

        public async Task<IActionResult> Index()
        {
            var routingSetting = await _dbContext.SystemSettings.FirstOrDefaultAsync(s => s.Key == "GlobalRoutingMode");
            int routingMode = routingSetting != null ? int.Parse(routingSetting.Value) : 0;

            if (routingMode == 1)
            {
                return View("/Views/Chat/Index.cshtml");
            }
            else
            {
                var viewModel = new IndexViewModel();
                return View("/Views/Chat/Index2.cshtml", viewModel);
            }
        }

        [HttpGet("privacy")]
        public IActionResult Privacy()
        {
            return View("/Views/Chat/Privacy.cshtml");
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }

    }

    public class ChatRequest
    {
        public string Prompt { get; set; } = string.Empty;
        public string Provider { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;
    }
    
}
