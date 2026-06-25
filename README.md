# ⛳ LLMCaddy — Your Self-Hosted AI Control Center

**Take complete ownership of your AI experience.**

LLMCaddy is a lightweight, open-source AI workspace that lets you connect directly to leading Large Language Models without sacrificing privacy, control, or flexibility.

Deploy LLMCaddy on your own VPS in minutes using Docker and enjoy a powerful AI environment with no platform lock-in, no unnecessary markups, and no compromise on data ownership.

**Explore LLMCaddy today at https://llmcaddy.com or self-host your own instance.**

---

## Why Choose LLMCaddy?

### 🛡️ Privacy First. Always.

Your AI conversations belong to you.

Unlike many AI platforms, LLMCaddy is designed so that your API keys remain under your control. Premium API keys are stored exclusively in your browser's local storage and are never collected, viewed, or stored on LLMCaddy servers.

To provide an additional layer of protection, LLMCaddy includes a built-in **Client-Side Privacy Redaction Engine** that automatically sanitizes sensitive information before any request is transmitted to external AI providers.

**Automatic Redaction Includes:**

* Social Security Numbers (SSN)
* Social Insurance Numbers (SIN)
* Credit Card Numbers
* IBAN Numbers
* Email Addresses
* Phone Numbers

All redactions occur locally within your browser before data leaves your device.

**Important:** Generic bank account numbers are not automatically redacted because banking formats vary significantly between countries and institutions. Users should exercise appropriate caution when sharing financial information.

---

### 🔄 Cloud Backup & Cross-Device Sync

Your conversations should follow you wherever you work.

LLMCaddy allows you to seamlessly move your chat history between devices:

* One-click backup to cloud
* Instant restoration from cloud on any device
* Continue conversations across desktop, laptop, and mobile
* Never lose valuable prompts, research, or insights

---

### 🧠 Intelligent Semantic Search

Stop searching for exact keywords.

LLMCaddy includes a built-in semantic search engine that runs entirely within your browser. Instead of matching words, it understands meaning and context.

**Example:**

You search for:

> "That OpenAI token limit error from yesterday"

LLMCaddy can locate conversations containing related errors such as:

* RateLimitError
* context_length_exceeded
* API quota issues

—even if the word "token" never appeared in the original conversation title.

Because vector generation and indexing happen locally, your search experience remains fast and private.

---

## Flexible Deployment Options

Whether you're an individual developer or managing a team, LLMCaddy adapts to your workflow.

### ⚡ Pure JS Proxy Mode (Individual Users)

The fastest way to get started.

Simply save your API keys locally and begin chatting immediately.

**Benefits:**

* No server-side API key storage
* Direct browser-to-provider communication
* Local conversation storage
* Minimal setup
* Maximum privacy

Perfect for developers, researchers, consultants, and AI enthusiasts.

---

### 👥 Server-Managed Mode (Teams & Organizations)

Need centralized management while maintaining privacy-focused architecture?

Enable Server-Managed Mode to unlock:

* Multi-user account management
* Secure authentication
* Administrative controls
* Shared organizational deployment
* Team-friendly governance

Ideal for businesses, educational institutions, and private communities.

---

## 🎯 Enhanced Intelligence on LLMCaddy.com

When using LLMCaddy.com, you can unlock additional productivity features designed to improve AI response quality while reducing token consumption.

Our cloud-enhanced interface can:

* Apply specialized AI personas
* Automatically summarize historical context
* Compress conversation memory into highly efficient prompts
* Deliver more relevant responses with lower token usage

The result is a smarter assistant that remembers more while costing less.

---

## 🚀 Get Started in Minutes

Deploy LLMCaddy on your Linux VPS with Docker Compose.

### Clone the Repository

```bash
git clone https://github.com/your-username/llmcaddy.git
cd llmcaddy
```

### Launch LLMCaddy

```bash
docker compose up -d
```

### Open Your Workspace

Navigate to:

```text
http://your-vps-ip:8080
```

You're ready to start chatting with your favorite AI models under your own control.

---

## 🌟 Open Source & Community Driven

LLMCaddy is proudly released under the MIT License.

Fork it. Customize it. Extend it. Deploy it anywhere.

Build your own private AI platform without restrictions.

**Your Models. Your Data. Your Infrastructure.**

**That's the LLMCaddy difference.**


Discover what LLMCaddy can do for you at https://llmcaddy.com and experience a smarter, more private way to work with AI.
