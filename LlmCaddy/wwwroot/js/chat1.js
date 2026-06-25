import { dbClient } from './database.js';
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2/dist/transformers.min.js';

if (typeof pdfjsLib !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const adjectives = [
    'ancient', 'atomic', 'bionic', 'bitter', 'blank', 'blazing', 'blind', 'bold', 'brave', 'breezy',
    'bright', 'bronze', 'calm', 'clever', 'cold', 'cosmic', 'crazy', 'crisp', 'crypto', 'cyan',
    'daring', 'dark', 'dawn', 'decent', 'deep', 'dense', 'divine', 'dry', 'eager', 'early',
    'elastic', 'electric', 'elegant', 'epic', 'eternal', 'exotic', 'fancy', 'fast', 'fatal', 'fierce',
    'final', 'first', 'flashy', 'flat', 'flying', 'formal', 'fresh', 'frosty', 'frozen', 'gentle',
    'giant', 'glamorous', 'global', 'golden', 'grand', 'gray', 'great', 'green', 'grim', 'heavy',
    'hidden', 'hollow', 'holy', 'honest', 'huge', 'humble', 'hyper', 'icy', 'infinite', 'inner',
    'ionic', 'iron', 'jolly', 'jungle', 'keen', 'kinetic', 'light', 'linear', 'liquid', 'lively',
    'local', 'lone', 'lucky', 'lunar', 'magic', 'magnetic', 'mega', 'mellow', 'modern', 'mystic',
    'native', 'natural', 'neon', 'neutral', 'new', 'noble', 'nomad', 'nordic', 'odd', 'silent'
];

const colors = [
    'amber', 'apricot', 'aqua', 'avocado', 'azure', 'banana', 'beige', 'berry', 'black', 'blue',
    'blush', 'bone', 'brass', 'brick', 'bronze', 'brown', 'bubblegum', 'burgundy', 'butter', 'camel',
    'canary', 'caramel', 'charcoal', 'cherry', 'chestnut', 'chocolate', 'citron', 'clover', 'cobalt', 'cocoa',
    'copper', 'coral', 'cornflower', 'cream', 'crimson', 'denim', 'desert', 'emerald', 'espresso', 'fern',
    'firebrick', 'flax', 'forest', 'fuchsia', 'ginger', 'gold', 'grape', 'graphite', 'gray', 'green',
    'hazel', 'heather', 'honey', 'hotpink', 'indigo', 'ink', 'iris', 'ivory', 'jade', 'jasmine',
    'khaki', 'lavender', 'lemon', 'lilac', 'lime', 'magenta', 'mahogany', 'mango', 'maroon', 'mauve',
    'mint', 'moss', 'mustard', 'navy', 'oatmeal', 'ochre', 'olive', 'onyx', 'opal', 'orange',
    'orchid', 'peach', 'pear', 'pearl', 'periwinkle', 'pewter', 'pink', 'plum', 'pumpkin', 'purple',
    'ruby', 'salmon', 'sapphire', 'scarlet', 'silver', 'tan', 'teal', 'tomato', 'violet', 'white'
];

const nouns = [
    'anchor', 'apple', 'arrow', 'astronaut', 'atlas', 'avalanche', 'badger', 'beacon', 'bear', 'beetle',
    'bison', 'blade', 'boulder', 'breeze', 'camel', 'canyon', 'castle', 'cheetah', 'cliff', 'cloud',
    'comet', 'compass', 'condor', 'crater', 'crystal', 'cyborg', 'dolphin', 'dragon', 'eagle', 'earth',
    'echo', 'eclipse', 'engine', 'falcon', 'fender', 'forest', 'fossil', 'fox', 'galaxy', 'glacier',
    'glitch', 'grizzly', 'hammer', 'hawk', 'horizon', 'hurricane', 'island', 'jaguar', 'jungle', 'jupiter',
    'koala', 'laser', 'leopard', 'lion', 'lizard', 'locust', 'magma', 'magnet', 'mammoth', 'mantis',
    'matrix', 'meteor', 'mirror', 'monkey', 'moon', 'mountain', 'nebula', 'neuron', 'ocean', 'orbit',
    'panther', 'penguin', 'phoenix', 'photon', 'pilot', 'pixel', 'planet', 'prism', 'pulsar', 'python',
    'quantum', 'quasar', 'radar', 'raven', 'river', 'robot', 'rocket', 'rover', 'satellite', 'scout',
    'shadow', 'shark', 'shield', 'sonic', 'spark', 'sphere', 'sphinx', 'star', 'storm', 'vortex'
];

function cyrb128(str) {
    let h1 = 1779033703, h2 = 3024733165, h3 = 3362453659, h4 = 502494819;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h4 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1^h2^h3^h4)>>>0, (h2^h1)>>>0, (h3^h1)>>>0, (h4^h1)>>>0];
}

function uuidToWords(uuid) {
    const hashes = cyrb128(uuid);
    const adjIndex = hashes[0] % adjectives.length;
    const colorIndex = hashes[1] % colors.length;
    const nounIndex = hashes[2] % nouns.length;
    return `${adjectives[adjIndex]}-${colors[colorIndex]}-${nouns[nounIndex]}`;
}

let pendingAttachments = [];
const coreProviders = [
    { id: "openai",    api: "https://api.openai.com/v1/chat/completions",                        name: "ChatGPT", model: "gpt-4o" },
    { id: "anthropic", api: "https://api.anthropic.com/v1/messages",                             name: "Claude",  model: "claude-sonnet-4-6" },
    { id: "google",    api: "https://generativelanguage.googleapis.com/v1beta/chat/completions", name: "Gemini",  model: "gemini-2.0-flash" },
    { id: "groq",      api: "https://api.groq.com/openai/v1/chat/completions",                  name: "Groq",    model: "llama-3.3-70b-versatile" },
    { id: "mistral",   api: "https://api.mistral.ai/v1/chat/completions",                       name: "Mistral", model: "mistral-large-latest" },
    { id: "cohere",    api: "https://api.cohere.com/v2/chat",                                   name: "Cohere",  model: "command-r-plus" },
    { id: "deepseek",  api: "https://api.deepseek.com/chat/completions",                        name: "DeepSeek",model: "deepseek-chat" }
];

let selectedProviders = new Set();
let allLoadedProviders = [];

async function verifyAndInitializeApplication() {
    console.log("⏳ [SERVER MODE] Initializing UI and checking database state...");   
    if (typeof renderAllBadges === "function") await renderAllBadges();
    try {
        await dbClient.ensureReady();
        console.log("🛠️ Verifying database schema tables...");       
        updateDbAlertBanner("loading", "Database Connected", "Checking sync status and compiling local schema layouts...");
        let currentBinaryData = new Uint8Array(0);
        try {
            const root = await navigator.storage.getDirectory();
            const fileHandle = await root.getFileHandle("llmcaddy.db", { create: true });
            const file = await fileHandle.getFile();
            const buffer = await file.arrayBuffer();
            currentBinaryData = new Uint8Array(buffer);           
            console.log(`📂 [OPFS] Read file successfully. Size: ${currentBinaryData.length} bytes.`);
        } catch (opfsErr) {
            console.warn("⚠️ OPFS file access fell through, using empty array fallback.", opfsErr);
        }

        if (currentBinaryData.length > 50) {
            let recordsExist = false;
            try {
                const countCheck = await dbClient.query("SELECT name FROM sqlite_master WHERE type='table' AND name='ChatLogs';");
                if (countCheck.length > 0) {
                    const countResult = await dbClient.query("SELECT COUNT(*) as total FROM ChatLogs;");
                    if (countResult && countResult.length > 0 && countResult[0].total > 0) {
                        recordsExist = true;
                    }
                }
            } catch (e) {}

            if (recordsExist && typeof synchronizeAnonymousProxy === "function") {
                console.log("📤 [SYNC BOOT] Local records detected. Syncing upstream to anonymous proxy repository...");
                await synchronizeAnonymousProxy(currentBinaryData);
            }
        } else {
            // ✅ CORRECT FOR ANONYMOUS: No automatic background network pulls.
            console.log("📥 [BOOT] Local database structure empty. Allocating anonymous instance containers...");
            try {
                const root = navigator.storage ? await navigator.storage.getDirectory() : null;
                if (root) {
                    await root.getFileHandle("llmcaddy.db", { create: true });
                }
            } catch (fsErr) {
                console.warn("⚠️ Safe file allocation bypass:", fsErr);
            }
        }
        
        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS ChatLogs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt TEXT NOT NULL,
                response TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                embedding TEXT 
            );
        `);

        const columns = await dbClient.query(`PRAGMA table_info(ChatLogs);`);
        const hasEmbedding = columns.some(col => col.name === "embedding");
        if (!hasEmbedding) {
            await dbClient.query(`ALTER TABLE ChatLogs ADD COLUMN embedding TEXT;`);
            console.log("✅ embedding column added to ChatLogs.");
        }

        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS DocumentChunks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                filename    TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                content     TEXT NOT NULL,
                embedding   TEXT NOT NULL,
                timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS CustomProviders (
                Id TEXT PRIMARY KEY,
                DisplayName TEXT NOT NULL,
                BaseUrl TEXT NOT NULL,
                DefaultModel TEXT NOT NULL
            );
        `);

        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS HiddenCoreProviders (
                ProviderId TEXT PRIMARY KEY
            );
        `);

        const verification = await dbClient.query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='ChatLogs';"
        );

        if (verification.length === 0) {
            throw new Error("Table creation sequence executed but table is absent.");
        }

        console.log("🚀 Success: 'ChatLogs' table is confirmed active inside SQLite WASM!");
        
        if (typeof updateDBBadgeStatus === "function") updateDBBadgeStatus(true);
        if (typeof updateDbAlertBanner === "function") {
            updateDbAlertBanner("success", "SQLite Engine Ready", "Connected to persistent OPFS sandbox. Cloud synchronized account logs are active.");
        }
        
        if (typeof renderAllBadges === "function") await renderAllBadges();
        
        // Triggers immediate automatic loading once the baseline init sequence closes
        setTimeout(async () => {
            if (typeof loadAllTopics === "function") {
                console.log("🔄 Automatically updating left sidemenu history list context...");
                await loadAllTopics();
            }
        }, 50);

    } catch (e) {
        console.error("❌ Diagnostic verification routine failed:", e);
        if (typeof updateDBBadgeStatus === "function") updateDBBadgeStatus(false);
        
        if (e && e.message && (e.message.includes("SQLITE_NOTADB") || e.message.includes("is not a database") || e.message.includes("NoModificationAllowedError"))) {
            console.warn("🚨 Persistent database file lock or corruption detected! Launching Isolation Recovery...");           
            try {
                await dbClient.forcePurgeLockedDatabase();
                alert("⚠️ Your local database context was locked or unreadable. It has been securely reset. Reloading now...");
            } catch (purgeErr) {
                console.error("Critical: Worker failed to break the file lock:", purgeErr);
            } finally {
                window.location.reload();
            }
            return;
        }
    }
}

function updateDBBadgeStatus(isOnline) {
    const badge = document.getElementById("db-status-badge");
    if (!badge) return;
    
    if (isOnline) {
        badge.textContent = "SQLite Local: Connected";
        badge.className = "bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300";
    } else {
        badge.textContent = "SQLite Local: Offline Error";
        badge.className = "bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300";
    }
}

function updateDbAlertBanner(status, title, message) {
    const banner = document.getElementById("db-info-alert");
    const iconNode = document.getElementById("alert-icon");
    const titleNode = document.getElementById("alert-title");
    const messageNode = document.getElementById("alert-message");

    if (!banner || !titleNode || !messageNode) return;

    titleNode.textContent = title + ": ";
    messageNode.textContent = message;

    banner.className = "max-w-md mx-auto my-4 p-4 rounded-xl text-sm border flex items-center gap-3 transition-all duration-300 ";

    if (status === "loading") {
        iconNode.textContent = "⏳";
        banner.classList.add("bg-blue-50", "border-blue-200", "text-blue-800");
    } else if (status === "success") {
        iconNode.textContent = "✅";
        banner.classList.add("bg-green-50", "border-green-200", "text-green-800");
        
        setTimeout(() => {
            banner.classList.add("opacity-0", "h-0", "my-0", "p-0", "overflow-hidden");
        }, 4000);
    } else if (status === "error") {
        iconNode.textContent = "❌";
        banner.classList.add("bg-red-50", "border-red-200", "text-red-800");
    }
}

document.addEventListener("click", (e) => {
    const badge = e.target.closest("[data-action='select']");
    if (badge) {
        selectModel(badge.dataset.name, badge.dataset.id);
        return;
    }

    const addBtn = e.target.closest("[data-action='add-provider']");
    if (addBtn) {
        openSettingsModal(null, true);
        return;
    }
});

async function renderAllBadges() {
    const container = document.getElementById("model-badges");
    if (!container) return;

    container.innerHTML = "";
    allLoadedProviders = [];

    let hiddenCoreIds = new Set();
    if (typeof dbClient !== "undefined" && dbClient.isReady) {
        try {
            const hiddenRows = await dbClient.query("SELECT ProviderId FROM HiddenCoreProviders");
            hiddenRows.forEach(row => hiddenCoreIds.add(row.ProviderId));
        } catch (err) {
            console.warn("Could not query HiddenCoreProviders yet:", err);
        }
    }

    coreProviders.forEach(p => {
        const isHiddenInStorage = localStorage.getItem(`llmcaddy_hidden_core_${p.id}`) === "true";
        if (!hiddenCoreIds.has(p.id) && !isHiddenInStorage) {
            allLoadedProviders.push(p);
        }
    });

    if (typeof dbClient !== "undefined" && dbClient.isReady) {
        try {
            const rows = await dbClient.query("SELECT Id, DisplayName FROM CustomProviders");
            rows.forEach(row => {
                allLoadedProviders.push({ id: row.Id, name: row.DisplayName, isCustom: true });
            });
        } catch (e) {
            console.error("Could not load custom entries yet:", e);
        }
    }

    allLoadedProviders.forEach(provider => {
        const isCustom = provider.isCustom === true;

        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position:relative; display:inline-flex; align-items:center;";

        const badge = document.createElement("span");
        badge.id = `badge-${provider.id}`;
        badge.className = "cursor-pointer px-2 py-1 rounded text-xs font-medium transition-all select-none";
        badge.textContent = provider.name;
        badge.dataset.action = "select";
        badge.dataset.id = provider.id;
        badge.dataset.name = provider.name;

        const gear = document.createElement("button");
        gear.innerHTML = "⚙";
        gear.title = "Settings";
        gear.style.cssText = [
            "opacity: 0",
            "margin-left: 2px",
            "padding: 2px 4px",
            "font-size: 11px",
            "line-height: 1",
            "color: #94a3b8",
            "background: transparent",
            "border: none",
            "border-radius: 3px",
            "cursor: pointer",
            "transition: opacity 0.15s ease, color 0.15s ease"
        ].join(";");

        wrapper.addEventListener("mouseenter", () => gear.style.opacity = "1");
        wrapper.addEventListener("mouseleave", () => gear.style.opacity = "0");

        gear.addEventListener("mouseenter", () => gear.style.color = "#f97316");
        gear.addEventListener("mouseleave", () => gear.style.color = "#94a3b8");

        gear.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            openSettingsModal(provider.id, isCustom);
        });

        wrapper.appendChild(badge);
        wrapper.appendChild(gear);
        container.appendChild(wrapper);

        refreshBadgeUI(provider.id);
    });
}

function refreshBadgeUI(id) {
    const badge = document.getElementById(`badge-${id}`);
    if (!badge) return;

    const token = localStorage.getItem(`llmcaddy_api_key_${id}`);
    const hasKey = token !== null && token.trim().length > 0;
    const isSelected = selectedProviders.has(id);

    badge.style.transition = "all 0.2s ease";

    if (isSelected) {
        badge.style.backgroundColor = "#f97316";
        badge.style.color = "#ffffff";
        badge.style.boxShadow = "0 0 0 2px #fdba74";
    } else if (hasKey) {
        badge.style.backgroundColor = "#ffedd5";
        badge.style.color = "#ea580c";
        badge.style.boxShadow = "none";
    } else {
        badge.style.backgroundColor = "#e2e8f0";
        badge.style.color = "#475569";
        badge.style.boxShadow = "none";
    }
}

function selectModel(name, id) {
    if (selectedProviders.has(id)) {
        selectedProviders.delete(id);
    } else {
        selectedProviders.clear();
        selectedProviders.add(id);
    }
    allLoadedProviders.forEach(p => refreshBadgeUI(p.id));
}

async function openSettingsModal(id = null, isCustom = false) {
    try {
        const existing = document.getElementById("settings-modal-wrapper");
        if (existing) existing.remove();

        let displayName = "", apiKey = "", baseUrl = "", defaultModel = "";

        if (id) {
            apiKey = localStorage.getItem(`llmcaddy_api_key_${id}`) || "";
            if (isCustom) {
                if (typeof dbClient !== "undefined" && dbClient.isReady) {
                    try {
                        const results = await dbClient.query(
                            "SELECT DisplayName, BaseUrl, DefaultModel FROM CustomProviders WHERE Id = ?", [id]
                        );
                        if (results && results.length > 0) {
                            displayName = results[0].DisplayName;
                            baseUrl     = results[0].BaseUrl;
                            defaultModel = results[0].DefaultModel;
                        }
                    } catch (e) {
                        console.warn("CustomProviders lookup failed:", e);
                    }
                }
            } else {
                const core = coreProviders.find(p => p.id === id);
                displayName = core ? core.name : id;
            }
        }

        const modal = document.createElement("div");
        modal.id = "settings-modal-wrapper";
        modal.style.cssText = [
            "position:fixed",
            "inset:0",
            "top:0",
            "left:0",
            "right:0",
            "bottom:0",
            "width:100%",
            "height:100%",
            "background:rgba(15,23,42,0.5)",
            "backdrop-filter:blur(4px)",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            "z-index:9999",
            "padding:16px",
            "box-sizing:border-box"
        ].join(";");
        const showUrlModel = !id || isCustom;

        const card = document.createElement("div");
        card.style.cssText = "background:#fff;border:1px solid #e2e8f0;border-radius:16px;width:100%;max-width:384px;box-shadow:0 25px 50px rgba(0,0,0,0.15);display:flex;flex-direction:column;overflow:hidden;";

        const inner = document.createElement("div");
        inner.style.cssText = "padding:24px;display:flex;flex-direction:column;width:100%;box-sizing:border-box;";

        const titleWrap = document.createElement("div");
        titleWrap.style.cssText = "text-align:center;margin-bottom:20px;";
        const title = document.createElement("h3");
        title.style.cssText = "margin:0;font-size:18px;font-weight:700;color:#1e293b;";
        title.textContent = id ? `Modify ${displayName}` : "Add Custom LLM Endpoint";
        const subtitle = document.createElement("p");
        subtitle.style.cssText = "margin:4px 0 0;font-size:11px;color:#94a3b8;";
        subtitle.textContent = "Configuration details are stored within your client sandbox environment.";
        titleWrap.appendChild(title);
        titleWrap.appendChild(subtitle);

        function makeField(labelText, inputId, type, value, disabled) {
            const wrap = document.createElement("div");
            const label = document.createElement("label");
            label.style.cssText = "display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;";
            label.textContent = labelText;
            const input = document.createElement("input");
            input.type = type || "text";
            input.id = inputId;
            input.value = value || "";
            input.disabled = !!disabled;
            input.style.cssText = "width:100%;padding:10px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;background:" + (disabled ? "#f1f5f9" : "#f8fafc") + ";color:" + (disabled ? "#94a3b8" : "#1e293b") + ";box-sizing:border-box;outline:none;";
            input.addEventListener("focus", () => { if (!disabled) input.style.boxShadow = "0 0 0 2px #f97316"; });
            input.addEventListener("blur",  () => input.style.boxShadow = "none");
            wrap.appendChild(label);
            wrap.appendChild(input);
            return wrap;
        }

        const fields = document.createElement("div");
        fields.style.cssText = "display:flex;flex-direction:column;gap:16px;margin-bottom:24px;";

        const nameField = makeField("Display Name", "modalName", "text", displayName, id && !isCustom);
        fields.appendChild(nameField);

        let urlInput = null, modelInput = null;
        if (showUrlModel) {
            const urlField   = makeField("Base API Gateway Endpoint URL", "modalUrl",   "text", baseUrl);
            const modelField = makeField("Target Model Identifier",        "modalModel", "text", defaultModel);
            urlInput   = urlField.querySelector("input");
            modelInput = modelField.querySelector("input");
            fields.appendChild(urlField);
            fields.appendChild(modelField);
        }

        const keyField  = makeField("API Key", "modalKey", "password", apiKey);
        fields.appendChild(keyField);

        const nameInput = nameField.querySelector("input");
        const keyInput  = keyField.querySelector("input");

        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding-top:16px;border-top:1px solid #f1f5f9;";

        const footerLeft  = document.createElement("div");
        const footerRight = document.createElement("div");
        footerRight.style.cssText = "display:flex;align-items:center;gap:8px;";

        function makeBtn(label, bg, color, hoverBg) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = label;
            btn.style.cssText = "padding:8px 16px;font-size:14px;font-weight:600;border:none;border-radius:8px;cursor:pointer;background:" + bg + ";color:" + color + ";";
            btn.addEventListener("mouseenter", () => btn.style.background = hoverBg);
            btn.addEventListener("mouseleave", () => btn.style.background = bg);
            return btn;
        }

        let deleteBtn = null;
        if (id) {
            deleteBtn = makeBtn("Remove", "#fef2f2", "#dc2626", "#fee2e2");
            footerLeft.appendChild(deleteBtn);
        }
        const cancelBtn = makeBtn("Cancel", "#f1f5f9", "#475569", "#e2e8f0");
        const saveBtn   = makeBtn("Save",   "#f97316", "#ffffff", "#ea580c");
        footerRight.appendChild(cancelBtn);
        footerRight.appendChild(saveBtn);
        footer.appendChild(footerLeft);
        footer.appendChild(footerRight);

        inner.appendChild(titleWrap);
        inner.appendChild(fields);
        inner.appendChild(footer);
        card.appendChild(inner);
        modal.appendChild(card);
        document.body.appendChild(modal);

        saveBtn.addEventListener("click", async () => {
            const keyVal   = keyInput.value.trim();
            const nameVal  = nameInput.value.trim();
            let targetId   = id;

            if (targetId) {
                if (isCustom) {
                    const urlVal   = urlInput   ? urlInput.value.trim()   : "";
                    const modelVal = modelInput ? modelInput.value.trim() : "";
                    if (typeof dbClient !== "undefined" && dbClient.isReady) {
                        try {
                            await dbClient.query(
                                "UPDATE CustomProviders SET DisplayName = ?, BaseUrl = ?, DefaultModel = ? WHERE Id = ?",
                                [nameVal, urlVal, modelVal, targetId]
                            );
                        } catch (err) { console.error("Update failed:", err); }
                    }
                }
            } else {
                targetId = "custom-" + Date.now();
                const urlVal   = urlInput   ? urlInput.value.trim()   : "";
                const modelVal = modelInput ? modelInput.value.trim() : "";
                if (!nameVal || !urlVal || !modelVal) {
                    alert("Please fill in all endpoint details.");
                    return;
                }
                if (typeof dbClient !== "undefined" && dbClient.isReady) {
                    try {
                        await dbClient.query(
                            "INSERT INTO CustomProviders (Id, DisplayName, BaseUrl, DefaultModel) VALUES (?, ?, ?, ?)",
                            [targetId, nameVal, urlVal, modelVal]
                        );
                    } catch (err) { console.error("Insert failed:", err); }
                }
            }

            if (keyVal.length > 0) {
                localStorage.setItem(`llmcaddy_api_key_${targetId}`, keyVal);
            } else {
                localStorage.removeItem(`llmcaddy_api_key_${targetId}`);
            }

            modal.remove();
            
            await triggerOpfsToRemoteSync();
            await renderAllBadges();
        });

        if (id && deleteBtn) {
            deleteBtn.addEventListener("click", async () => {
                if (!confirm(`Are you sure you want to permanently remove ${displayName}?`)) return;

                if (isCustom) {
                    if (typeof dbClient !== "undefined" && dbClient.isReady) {
                        try {
                            await dbClient.query("DELETE FROM CustomProviders WHERE Id = ?", [id]);
                        } catch (err) { console.error("Delete failed:", err); }
                    }
                } else {
                    if (typeof dbClient !== "undefined" && dbClient.isReady) {
                        try {
                            await dbClient.query(
                                "INSERT OR IGNORE INTO HiddenCoreProviders (ProviderId) VALUES (?)", [id]
                            );
                        } catch {
                            localStorage.setItem(`llmcaddy_hidden_core_${id}`, "true");
                        }
                    } else {
                        localStorage.setItem(`llmcaddy_hidden_core_${id}`, "true");
                    }
                }

                localStorage.removeItem(`llmcaddy_api_key_${id}`);
                selectedProviders.delete(id);
                modal.remove();
                
                await triggerOpfsToRemoteSync();
                await renderAllBadges();
            });
        }

        cancelBtn.addEventListener("click", () => modal.remove());
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.remove();
        });
    } catch (err) {
        console.error("openSettingsModal crashed at:", err);
    }
}

// ─── Chat Execution Pipeline ──────────────────────────────────────────
async function handleSendQuery() {
    const inputElement = document.getElementById("chatInput");
    if (!inputElement) return;

    const basePrompt = inputElement.value.trim();
    if (!basePrompt) return;

    const currentProviderId = selectedProviders.size > 0 ? Array.from(selectedProviders)[0] : "none";

    if (currentProviderId === "none") {
        alert("Please select a provider first.");
        return;
    }

    const savedApiKey = localStorage.getItem(`llmcaddy_api_key_${currentProviderId}`);
    if (!savedApiKey) {
        alert(`No API key saved for ${currentProviderId}. Click the ⚙ gear icon to add one.`);
        return;
    }

    const sanitizedPrompt = basePrompt
        .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, "[REDACTED-SSN/SIN]")
        .replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/g, "[REDACTED-EMAIL]")
        .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, "[REDACTED-CC]")
        .replace(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED-PHONE]")
        .replace(/\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){1,7}[A-Z0-9]{1,4}\b/g, "[REDACTED-IBAN]");

    let finalPrompt = sanitizedPrompt;
    const relevantChunks = await ragRetrieve(sanitizedPrompt);

    if (relevantChunks.length > 0) {
        const context = relevantChunks
            .map(c => `[From ${c.source}]: ${c.text}`)
            .join("\n\n");
        finalPrompt = `Use the following context to help answer the question if relevant. If the context isn't relevant, ignore it and answer normally.\n\n--- CONTEXT ---\n${context}\n--- END CONTEXT ---\n\nQuestion: ${sanitizedPrompt}`;
    }

    if (pendingAttachments.length > 0 && typeof dbClient !== "undefined" && dbClient.isReady) {
        for (const file of pendingAttachments) {
            for (let i = 0; i < file.chunks.length; i++) {
                await dbClient.query(
                    "INSERT INTO DocumentChunks (filename, chunk_index, content, embedding) VALUES (?, ?, ?, ?)",
                    [file.name, i, file.chunks[i].text, JSON.stringify(file.chunks[i].embedding)]
                );
            }
        }
        pendingAttachments = [];
        document.getElementById("fileChips").innerHTML = "";
    }

    inputElement.value = "";
    appendMessageToUI("user", basePrompt);

    const trackingId = "ai-" + Date.now();
    appendMessageToUI("llmcaddy", "Thinking...", trackingId);
    const textNode = document.getElementById(trackingId);

    try {
        const coreProvider = coreProviders.find(p => p.id === currentProviderId);
        let apiUrl, modelId, isCustom = false;

        if (coreProvider) {
            apiUrl  = coreProvider.api;
            modelId = coreProvider.model;
        } else {
            const rows = await dbClient.query(
                "SELECT BaseUrl, DefaultModel FROM CustomProviders WHERE Id = ?", [currentProviderId]
            );
            if (!rows || rows.length === 0) throw new Error("Custom provider not found in database.");
            apiUrl   = rows[0].BaseUrl;
            modelId  = rows[0].DefaultModel;
            isCustom = true;
        }

        const requestBody = JSON.stringify({
            model: modelId,
            messages: [{ role: "user", content: finalPrompt }],
            stream: false
        });

        const headers = { "Content-Type": "application/json" };
        if (currentProviderId === "anthropic") {
            headers["x-api-key"]         = savedApiKey;
            headers["anthropic-version"] = "2023-06-01";
        } else {
            headers["Authorization"] = `Bearer ${savedApiKey}`;
        }

        const response = await fetch(apiUrl, {
            method: "POST",
            headers,
            body: requestBody
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorBody}`);
        }

        const data = await response.json();

        let reply = "";
        if (currentProviderId === "anthropic") {
            reply = data.content?.[0]?.text ?? "No response.";
        } else if (data.choices?.[0]?.message?.content) {
            reply = data.choices[0].message.content;
        } else if (data.message?.content?.[0]?.text) {
            reply = data.message.content[0].text;
        } else {
            reply = JSON.stringify(data, null, 2);
        }

        if (textNode) textNode.innerHTML = marked.parse(reply);

        if (typeof dbClient !== "undefined" && dbClient.isReady) {
            const embedding = await generateEmbedding(basePrompt + " " + reply);
            await dbClient.query(
                "INSERT INTO ChatLogs (prompt, response, embedding) VALUES (?, ?, ?);",
                [basePrompt, reply, JSON.stringify(embedding)]
            );
            await loadAllTopics();
            await triggerOpfsToRemoteSync();
        }

    } catch (err) {
        console.error(err);
        if (textNode) textNode.textContent = `Error: ${err.message}`;
    }
}

function appendMessageToUI(sender, text, trackingId = null) {
    const frame = document.getElementById("chatHistory");
    if (!frame) return;

    const row = document.createElement("div");
    if (sender === "user") {
        row.className = "flex justify-end gap-3";
        row.innerHTML = `<div class="bg-blue-600 text-white p-4 rounded-2xl rounded-tr-none text-sm max-w-2xl">${text.replace(/</g, "&lt;")}</div>`;
    } else {
        row.className = "flex justify-start gap-3";
        row.innerHTML = `
            <div class="bg-white border p-5 rounded-2xl rounded-tl-none text-sm w-full">
                <p class="font-semibold text-xs text-slate-400 mb-2">LlmCaddy</p>
                <div id="${trackingId || ""}" class="prose text-sm"></div>
            </div>`;
    }

    frame.appendChild(row);
    const scrollContainer = frame.parentElement;
    if (scrollContainer) {
        scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: "smooth"
        });
    }    
}

window.handleSendQuery = handleSendQuery;

// ─── App Bootloader ───────────────────────────────────────────────────
function initializeEventListeners() {
    verifyAndInitializeApplication();

    const inputField = document.getElementById("chatInput");
    if (inputField) {
        inputField.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendQuery();
            }
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initializeEventListeners());
} else {
    initializeEventListeners();
}

async function exportDatabase() {
    try {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle("llmcaddy.db");
        const file = await fileHandle.getFile();
        const url  = URL.createObjectURL(file);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = "llmcaddy.db";
        a.click();
        URL.revokeObjectURL(url);
        console.log("✅ llmcaddy.db exported successfully.");
    } catch (err) {
        console.error("❌ Export failed:", err);
        alert(`Export failed: ${err.message}`);
    }
}
window.exportDatabase = exportDatabase;

// ─── Semantic Transformers Layout ────────────────────────────────────
let embeddingPipeline = null;
async function getEmbeddingPipeline() {
    if (embeddingPipeline) return embeddingPipeline;

    embeddingPipeline = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { dtype: 'q8' }
    );
    console.log("✅ Embedding pipeline ready.");
    return embeddingPipeline;
}

function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot   += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function semanticSearch(queryText, topN = 5) {
    const queryEmbedding = await generateEmbedding(queryText);
    const rows = await dbClient.query(
        "SELECT id, prompt, response, timestamp, embedding FROM ChatLogs WHERE embedding IS NOT NULL"
    );

    if (rows.length === 0) return [];

    const scored = rows.map(row => {
        const rowEmbedding = JSON.parse(row.embedding);
        const score        = cosineSimilarity(queryEmbedding, rowEmbedding);
        return { ...row, score };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);
}

async function generateEmbedding(text) {
    const pipe   = await getEmbeddingPipeline();
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}
window.semanticSearch = semanticSearch;

async function handleSemanticSearch() {
    const input       = document.getElementById("searchInput");
    const resultsList = document.getElementById("resultsList");
    const query       = input?.value.trim();

    if (!query) return;
    if (!resultsList) return;

    resultsList.innerHTML = `<li class="list-group-item text-slate-400 text-xs">Searching...</li>`;

    try {
        const results = await semanticSearch(query, 5);

        if (results.length === 0) {
            resultsList.innerHTML = `<li class="list-group-item text-slate-400 text-xs">No results found.</li>`;
            return;
        }

        resultsList.innerHTML = results.map(r => `
            <li class="list-group-item text-xs p-2 cursor-pointer hover:bg-slate-100"
                data-id="${r.id}"
                data-prompt="${r.prompt.replace(/"/g, '&quot;')}"
                data-response="${r.response.replace(/"/g, '&quot;')}"
                title="Score: ${r.score.toFixed(3)}">
                <div class="font-semibold text-slate-700 truncate">Q: ${r.prompt}</div>
                <div class="text-slate-400 truncate">A: ${r.response.slice(0, 80)}...</div>
                <div class="text-slate-300 text-[10px] mt-1">${r.timestamp} · ${(r.score * 100).toFixed(1)}%</div>
            </li>
        `).join("");

        resultsList.querySelectorAll("li[data-id]").forEach(li => {
            li.addEventListener("click", () => {
                const prompt   = li.dataset.prompt;
                const response = li.dataset.response;
                loadChatIntoView(prompt, response);
            });
        });

    } catch (err) {
        console.error("Semantic search failed:", err);
        resultsList.innerHTML = `<li class="list-group-item text-red-500 text-xs">Search error: ${err.message}</li>`;
    }
}
window.handleSemanticSearch = handleSemanticSearch;

function loadChatIntoView(prompt, response) {
    const frame = document.getElementById("chatHistory");
    if (!frame) return;

    frame.innerHTML = "";

    const userRow = document.createElement("div");
    userRow.className = "flex justify-end gap-3";
    userRow.innerHTML = `<div class="bg-blue-600 text-white p-4 rounded-2xl rounded-tr-none text-sm max-w-2xl">${prompt.replace(/</g, "&lt;")}</div>`;

    const aiRow = document.createElement("div");
    aiRow.className = "flex justify-start gap-3";
    aiRow.innerHTML = `
        <div class="bg-white border p-5 rounded-2xl rounded-tl-none text-sm w-full">
            <p class="font-semibold text-xs text-slate-400 mb-2">LlmCaddy</p>
            <div class="prose text-sm"></div>
        </div>`;
    aiRow.querySelector(".prose").innerHTML = marked.parse(response);

    frame.appendChild(userRow);
    frame.appendChild(aiRow);
    const scrollContainer = frame.parentElement; 
    if (scrollContainer) {
        scrollContainer.scrollTo({
            top: 0, 
            behavior: "smooth"
        });
    }
}

async function loadAllTopics() {
    const chatListContainer = document.getElementById("chat-history-sidebar-list");
    if (!chatListContainer) return;

    try {
        // Clear old list contents
        chatListContainer.innerHTML = "";

        // Query historical logs ordered by most recent
        const history = await dbClient.query("SELECT id, prompt, response FROM ChatLogs ORDER BY timestamp DESC;");
        if (!history || history.length === 0) return;

        history.forEach(chat => {
            const li = document.createElement("li");
            li.className = "chat-history-item flex items-center justify-between p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-all group";
            li.setAttribute("data-chat-id", chat.id);
            
            // Generate a clean summary preview safely
            const previewText = chat.prompt.length > 22 ? chat.prompt.substring(0, 22) + "..." : chat.prompt;

            li.innerHTML = `
                <span class="chat-title-text flex-1 truncate text-slate-300 group-hover:text-white">${previewText.replace(/</g, "&lt;")}</span>
                <button class="delete-chat-btn text-slate-500 hover:text-red-400 p-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" 
                        data-id="${chat.id}" 
                        title="Delete Conversation">
                    🗑️
                </button>
            `;

            // HANDLE POPUP IN MAIN WINDOW
            li.addEventListener("click", (e) => {
                // Ignore click if clicking the delete icon
                if (e.target.closest('.delete-chat-btn')) return;

                // Clear main window area first if you want a clean view
                const frame = document.getElementById("chatHistory");
                if (frame) frame.innerHTML = "";

                // Populate user message and response directly using your UI functions
                appendMessageToUI("user", chat.prompt);
                
                const trackingId = "ai-sidebar-" + chat.id;
                appendMessageToUI("llmcaddy", "", trackingId);
                
                const textNode = document.getElementById(trackingId);
                if (textNode && typeof marked !== "undefined") {
                    textNode.innerHTML = marked.parse(chat.response);
                } else if (textNode) {
                    textNode.textContent = chat.response;
                }
            });

            chatListContainer.appendChild(li);
        });
        bindDeleteButtonListeners();

    } catch (err) {
        console.error("Failed loading chat logs into sidebar navigation layout:", err);
    }
}
window.loadAllTopics = loadAllTopics;

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function bindDeleteButtonListeners() {
    const deleteButtons = document.querySelectorAll(".delete-chat-btn");
    
    deleteButtons.forEach(btn => {
        // Clear old event listeners using a clean clone replacement mechanism
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        // Attach fresh clean click listeners
        newBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation(); // 🌟 Stop execution from bubbling up to the row element click event
            
            const chatId = newBtn.getAttribute("data-id");
            if (!chatId) return;

            if (!confirm("Delete this conversation?")) return;

            try {
                console.log(`🧹 Purging Local Chat ID context item: ${chatId}`);
                
                // 1. Delete target row from local SQLite instance
                await dbClient.query("DELETE FROM ChatLogs WHERE id = ?;", [chatId]);
                
                // 2. Instantly reload sidebar list elements on screen
                await loadAllTopics();
                
                // 3. Reset main chat layout if the currently open chat was deleted
                if (window.currentActiveChatId == chatId) {
                    const workspace = document.getElementById("chatHistory") || document.getElementById("chat-box");
                    if (workspace) workspace.innerHTML = "";
                    window.currentActiveChatId = null;
                }

                // 4. Silently mirror database adjustments to PostgreSQL cloud nodes
                await triggerSilentUpstreamSync();

            } catch (err) {
                console.error("❌ Failed to clear database row:", err);
            }
        });
    });
}

async function triggerSilentUpstreamSync() {
    try {
        if (typeof dbClient === "undefined" || !dbClient.isReady) return;

        // Guard Check: Do not push sync updates if the database contains no conversations
        const counts = await dbClient.query("SELECT COUNT(*) as total FROM ChatLogs;");
        if (!counts || counts.length === 0 || counts[0].total === 0) {
            console.log("ℹ️ Database records returned 0 rows. Skipping silent server sync.");
            return;
        }

        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle("llmcaddy.db", { create: false });
        const file = await fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        const rawBytes = new Uint8Array(buffer);

        if (rawBytes.length > 0 && typeof synchronizeAnonymousProxy === "function") {
            await synchronizeAnonymousProxy(rawBytes);
            console.log("☁️ Backup synced upstream successfully.");
        }
    } catch (syncErr) {
        console.warn("⚠️ Background sync deferred:", syncErr.message);
    }
}

function startNewChat() {
    const frame = document.getElementById("chatHistory");
    if (frame) frame.innerHTML = "";
    const input = document.getElementById("chatInput");
    if (input) {
        input.value = "";
        input.focus();
    }
}
window.startNewChat = startNewChat;

// ─── RAG: Document Parsing Engine ─────────────────────────────────────
async function readFileAsText(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === "txt") {
        return await file.text();
    }

    if (ext === "pdf") {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(it => it.str).join(" ") + "\n";
        }
        return text;
    }

    if (ext === "docx") {
        const buf = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buf });
        return result.value;
    }

    throw new Error(`Unsupported file type: .${ext}`);
}

function chunkText(text, chunkSize = 500, overlap = 50) {
    const cleaned = text.replace(/\s+/g, " ").trim();
    const chunks = [];
    let start = 0;
    while (start < cleaned.length) {
        const end = Math.min(start + chunkSize, cleaned.length);
        chunks.push(cleaned.slice(start, end));
        start += (chunkSize - overlap);
    }
    return chunks.filter(c => c.length > 20);
}

async function processUploadedFile(file) {
    const text = await readFileAsText(file);
    const chunks = chunkText(text);

    const embeddedChunks = [];
    for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk);
        embeddedChunks.push({ text: chunk, embedding });
    }

    return { name: file.name, chunks: embeddedChunks };
}

async function handleFileSelection(fileList) {
    const chipBar = document.getElementById("fileChips");

    for (const file of Array.from(fileList)) {
        const chip = document.createElement("span");
        chip.className = "px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-lg flex items-center gap-2";
        chip.textContent = `⏳ ${file.name}`;
        chipBar.appendChild(chip);

        try {
            const processed = await processUploadedFile(file);
            pendingAttachments.push(processed);
            chip.textContent = `📄 ${file.name} (${processed.chunks.length} chunks)`;
            chip.dataset.name = file.name;

            const removeBtn = document.createElement("button");
            removeBtn.textContent = "✕";
            removeBtn.className = "text-slate-400 hover:text-red-500";
            removeBtn.onclick = () => {
                pendingAttachments = pendingAttachments.filter(a => a.name !== file.name);
                chip.remove();
            };
            chip.appendChild(removeBtn);

        } catch (err) {
            chip.textContent = `❌ ${file.name}: ${err.message}`;
            chip.classList.add("text-red-500");
        }
    }
}

async function ragRetrieve(queryText, topN = 4) {
    const queryEmbedding = await generateEmbedding(queryText);
    const candidates = [];

    pendingAttachments.forEach(file => {
        file.chunks.forEach(c => {
            candidates.push({
                source: file.name,
                text: c.text,
                score: cosineSimilarity(queryEmbedding, c.embedding)
            });
        });
    });

    if (typeof dbClient !== "undefined" && dbClient.isReady) {
        const rows = await dbClient.query("SELECT filename, content, embedding FROM DocumentChunks");
        rows.forEach(row => {
            candidates.push({
                source: row.filename,
                text: row.content,
                score: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding))
            });
        });
    }

    return candidates
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .filter(c => c.score > 0.3);
}

// ─── Core Cloud Synchronizer Logic ────────────────────────────────────
const SYNC_ENDPOINT = '/account/SyncAnonymousProxy';

function getOrCreateProxyClientId() {
    let clientId = localStorage.getItem('LlmCaddy_ProxyClientId');
    if (!clientId) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            clientId = crypto.randomUUID();
        } else {
            clientId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = (crypto.getRandomValues(new Uint8Array(1))[0]) % 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        localStorage.setItem('LlmCaddy_ProxyClientId', clientId);
        console.log(`[PROXY INIT] Fresh UUID successfully generated: ${clientId}`);
    }
    return clientId;
}

function uint8ArrayToBase64(uint8Array) {
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return window.btoa(binary);
}

async function compressUint8Array(uint8Array) {
    const stream = new Blob([uint8Array]).stream();
    const compressionStream = new CompressionStream('gzip');
    const compressedStream = stream.pipeThrough(compressionStream);
    
    const response = new Response(compressedStream);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
}

async function compressData(uint8Array) {
    const stream = new Blob([uint8Array]).stream();
    const compressionStream = new CompressionStream('gzip');
    const compressedStream = stream.pipeThrough(compressionStream);  
    const response = new Response(compressedStream);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
}

async function decompressData(uint8Array) {
    if (!uint8Array || uint8Array.length === 0) {
        return new Uint8Array(0);
    }

    // Double-check if it actually has Gzip magic bytes (1f 8b)
    if (uint8Array[0] !== 0x1f || uint8Array[1] !== 0x8b) {
        console.warn("⚠️ Data does not have Gzip magic bytes. Returning as raw data.");
        return uint8Array;
    }

    try {
        const blob = new Blob([uint8Array]);
        const decompressionStream = new DecompressionStream("gzip");
        const stream = blob.stream().pipeThrough(decompressionStream);
        
        const chunks = [];
        const reader = stream.getReader();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        
        // Reassemble uncompressed chunks into a single Uint8Array
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        
        console.log(`✅ Decompression completed successfully. Output size: ${result.length} bytes.`);
        return result;
    } catch (err) {
        console.error("❌ Native Decompression Stream Engine Failure:", err);
        throw err;
    }
}

window.handleCloudPush = async function() {
    try {
        const clientId = localStorage.getItem("LlmCaddy_ProxyClientId");
        if (!clientId) {
            alert("No Sync Client ID initialized on this device profile.");
            return;
        }

        const root = await navigator.storage.getDirectory();
        let fileHandle;
        try {
            fileHandle = await root.getFileHandle("llmcaddy.db");
        } catch {
            alert("Local storage database is completely empty. Nothing to push.");
            return;
        }

        const file = await fileHandle.getFile();
        const arrayBuffer = await file.arrayBuffer();
        const rawBytes = new Uint8Array(arrayBuffer);

        console.log(`📦 Uncompressed database payload: ${rawBytes.length} bytes.`);

        const compressedBytes = await compressData(rawBytes);
        const base64Payload = uint8ArrayToBase64(compressedBytes);
        console.log(`⚡ Compressed database payload to: ${compressedBytes.length} bytes.`);
        const mnemonicPhrase = uuidToWords(clientId).toLowerCase();

        const response = await fetch(`/account/SyncAnonymousProxy?clientId=${encodeURIComponent(clientId)}`, {
            method: "POST",
            headers: {
                "X-Proxy-Client-Id": clientId,
                "X-Proxy-Mnemonic-Phrase": mnemonicPhrase, 
                "Content-Type": "application/octet-stream" 
            },
            body: compressedBytes
        });

        if (response.ok) {
            const mnemonicPhrase = uuidToWords(clientId);
            
            alert(
                `✅ Backup Successful!\n\n` +
                `Your Sync ID is: ${clientId}\n\n` +
                `👉 Secure Mnemonic Phrase: [ ${mnemonicPhrase.toUpperCase()} ]\n\n` +
                `Please record this phrase somewhere safe. You will need this key when you pull data on other devices!`
            );
        } else {
            const errorText = await response.text();
            console.error("Server rejected stream payload:", errorText);
            alert("Server rejected the backup pipeline synchronization stream.");
        }
    } catch (err) {
        console.error("Cloud push failed:", err);
        alert(`Failed to complete push operation: ${err.message}`);
    }
};

window.handleCloudPull = async function() {
    const mnemonic = prompt("🔑 Please provide your unique Mnemonic Recovery Phrase to restore your database:");
    if (!mnemonic || !mnemonic.trim()) {
        alert("Action canceled: A valid mnemonic key is required.");
        return;
    }

    const confirmWipe = confirm("⚠️ Replace local chat history with your cloud backup?");
    if (!confirmWipe) return;

    try {
        const tokenElement = document.querySelector('input[name="__RequestVerificationToken"]');
        const headers = { 'Content-Type': 'application/json' };
        if (tokenElement) {
            headers['RequestVerificationToken'] = tokenElement.value;
        }

        const response = await fetch(`/account/SyncAnonymousProxy?clientId=${encodeURIComponent(mnemonic.trim())}`, {
            method: "GET",
            headers: headers,
            credentials: "same-origin" 
        });

        if (response.status === 204) {
            alert("Could not locate a cloud backup matching that mnemonic phrase.");
            return;
        }
        if (!response.ok) {
            throw new Error(`Server returned status code: ${response.status}`);
        }

        // 🌟 THE FIX: Read the master Client ID mapped to this database on the server
        const returnedClientId = response.headers.get("X-Returned-Client-Id");
        if (returnedClientId) {
            console.log(`🔄 [IDENTITY SYNC] Updating local Client ID footprint to match cloud node: ${returnedClientId}`);
            localStorage.setItem("LlmCaddy_ProxyClientId", returnedClientId);
        }

        const databaseBuffer = await response.arrayBuffer();
        const compressedBytes = new Uint8Array(databaseBuffer);

        if (!compressedBytes || compressedBytes.length === 0) {
            throw new Error("Downloaded server archive resolved empty.");
        }

        console.log(`🌀 Decompressing payload into raw database array...`);
        const rawDatabaseBytes = await decompressData(compressedBytes);

        if (!rawDatabaseBytes || rawDatabaseBytes.length === 0) {
            throw new Error("Decompressed database payload tracking arrays resolved empty.");
        }
        
        if (rawDatabaseBytes[0] !== 0x53 || rawDatabaseBytes[1] !== 0x51 || rawDatabaseBytes[2] !== 0x4c) {
            throw new Error("Decompression completed but missing valid SQLite format markers.");
        }

        console.log(`✅ Clean compilation. Releasing database client locks...`);
        if (dbClient && typeof dbClient.close === "function") {
            await dbClient.close().catch(() => {});
        }

        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle("llmcaddy.db", { create: true });
        const writable = await fileHandle.createWritable({ keepExistingData: false });
        await writable.write(rawDatabaseBytes);
        await writable.close();

        alert("🎉 Cloud restoration successful! Identity profile synchronized.");
        window.location.reload();
    } catch (err) { 
        console.error("💥 Anonymous Cloud Pull Exception:", err);
        alert(`Pull operation failed: ${err.message}`); 
    }
};

async function synchronizeAnonymousProxy(localDbUint8Array) {
    const proxyClientId = getOrCreateProxyClientId();
    const tokenElement = document.querySelector('input[name="__RequestVerificationToken"]');
    const token = tokenElement ? tokenElement.value : '';
    
    const isLocalDatabaseNew = (localDbUint8Array == null || localDbUint8Array.length === 0);
    
    if (isLocalDatabaseNew) {
        console.log(`[PROXY SYNC] Empty local state. Pulling from cloud node for ID: ${proxyClientId}`);
        try {
            const response = await fetch(`${SYNC_ENDPOINT}?clientId=${encodeURIComponent(proxyClientId)}`, { 
                method: 'GET' 
            });
            
            if (response.status === 204) {
                console.log("[PROXY SYNC] No backup row on server. Ready for fresh database initialization.");
                return null; 
            }
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                console.log("[PROXY SYNC] Success. Remote SQLite state mapped into Wasm space.");
                return new Uint8Array(arrayBuffer);
            }
        } catch (err) {
            console.error("[PROXY SYNC ERROR] Download step failed:", err);
        }
    } else {
        const MAX_QUOTA = 10 * 1024 * 1024; // 10 MB Limit
        if (localDbUint8Array.byteLength > MAX_QUOTA) {
            alert(`Sync failed: Database size exceeds the 10 MB limit.`);
            return localDbUint8Array;
        }

        console.log(`[PROXY SYNC] Sending backup updates upstream for ID: ${proxyClientId}`);
        const compressedBinary = await compressUint8Array(localDbUint8Array);
        
        const headers = { 
            'Content-Type': 'application/octet-stream',
            'X-Proxy-Client-Id': proxyClientId 
        };
        if (token) headers['RequestVerificationToken'] = token;

        try {
            const response = await fetch(`${SYNC_ENDPOINT}?clientId=${encodeURIComponent(proxyClientId)}`, {
                method: 'POST',
                headers: headers,
                body: compressedBinary 
            });
            
            if (response.ok) {
                console.log("[PROXY SYNC] PostgreSQL storage synchronization successfully written.");
            } else {
                console.error(`[PROXY SYNC] Server returned error response code: ${response.status}`);
            }
        } catch (err) {
            console.error("[PROXY SYNC ERROR] Network uplink drop:", err);
        }
    }
    return localDbUint8Array;
}

async function triggerOpfsToRemoteSync() {
    console.log("🔄 [SYNC] Checking database states before cloud upload...");
    try {
        if (typeof dbClient === "undefined" || !dbClient.isReady) return;

        // 🌟 Fix: Only back up if there are actual items in the database
        const counts = await dbClient.query("SELECT COUNT(*) as total FROM ChatLogs;");
        if (!counts || counts.length === 0 || counts[0].total === 0) {
            console.log("ℹ️ [SYNC] Local history table is completely empty. Skipping upstream synchronization payload.");
            return; 
        }

        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle("llmcaddy.db", { create: false });
        const file = await fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        const currentBinaryData = new Uint8Array(buffer);

        if (currentBinaryData.length > 0) {
            await synchronizeAnonymousProxy(currentBinaryData);
            console.log(`✅ [SYNC] Successfully backed up ${currentBinaryData.length} bytes to PostgreSQL.`);
        }
    } catch (err) {
        console.error("❌ [SYNC ERROR] Failed to capture or upload OPFS database block:", err);
    }
}

async function saveCustomProvider(providerData) {
    console.log(`💾 [CUSTOM PROVIDER] Writing config tracking fields for ID: ${providerData.id}`);
    
    if (typeof dbClient === "undefined" || !dbClient.isReady) {
        console.error("❌ Cannot save custom provider: local SQLite engine instance is not initialized.");
        alert("Local storage engine is down. Please verify database connection rules.");
        return;
    }

    try {
        await dbClient.query(
            `INSERT OR REPLACE INTO CustomProviders (Id, DisplayName, BaseUrl, DefaultModel) 
             VALUES (?, ?, ?, ?);`,
            [providerData.id, providerData.name, providerData.url, providerData.model]
        );
        
        console.log("✅ Provider committed locally. Triggering multi-user cloud backup sequence...");
        await triggerOpfsToRemoteSync();

        if (typeof renderAllBadges === "function") {
            await renderAllBadges();
        }
    } catch (err) {
        console.error("❌ Critical failure saving customized target provider metadata fields:", err);
        alert(`Failed to store custom configuration state variables: ${err.message}`);
    }
}

async function handleSaveCustomProviderFormClick() {
    const idInput    = document.getElementById("modalProviderId");
    const nameInput  = document.getElementById("modalProviderDisplayName");
    const urlInput   = document.getElementById("modalProviderBaseUrl");
    const modelInput = document.getElementById("modalProviderDefaultModel");
    const keyInput   = document.getElementById("modalProviderApiKey");

    const providerData = {
        id:    idInput.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, ''),
        name:  nameInput.value.trim(),
        url:   urlInput.value.trim(),
        model: modelInput.value.trim()
    };

    if (!providerData.id || !providerData.name || !providerData.url || !providerData.model) {
        alert("All custom provider variables must be fully specified.");
        return;
    }

    if (keyInput && keyInput.value.trim()) {
        localStorage.setItem(`llmcaddy_api_key_${providerData.id}`, keyInput.value.trim());
    }

    await saveCustomProvider(providerData);
    
    if (typeof closeSettingsModal === "function") {
        closeSettingsModal();
    }
}

async function clearExistingLocalDatabase(fileName) {
    try {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(fileName, { recursive: false });
        console.log(`🗑️ Successfully purged [${fileName}] from OPFS layout.`);
    } catch (err) {
        if (err.name === 'NotFoundError') {
            console.log(`ℹ️ No prior [${fileName}] instance found.`);
        } else {
            console.warn(`⚠️ removeEntry locked. Forcing truncation instead: ${err.message}`);
            try {
                const root = await navigator.storage.getDirectory();
                const fileHandle = await root.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable({ keepExistingData: false });
                await writable.write(new Uint8Array(0)); 
                await writable.close();
                console.log(`🧹 Successfully truncated locked file [${fileName}] to 0 bytes.`);
            } catch (truncErr) {
                console.error("❌ Extreme storage lock failure:", truncErr);
            }
        }
    }
}

const purgeBtn = document.getElementById("cloud-purge-btn");
if (purgeBtn) {
    purgeBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        
        const confirmFirst = confirm("⚠️ WARNING: This will completely delete your local chat logs from this browser. Are you absolutely sure?");
        if (!confirmFirst) return;
        
        const confirmSecond = confirm("🚨 Double Check: Any unsaved local sessions will be lost permanently if not backed up to the cloud. Proceed with full wipe?");
        if (!confirmSecond) return;

        try {
            console.log("🧹 Initializing manual workspace truncation...");
            
            // Call your internal script utility if defined, otherwise fall back to native OPFS deletion
            if (typeof clearExistingLocalDatabase === "function") {
                await clearExistingLocalDatabase("llmcaddy.db");
            } else {
                const root = await navigator.storage.getDirectory();
                await root.removeEntry("llmcaddy.db", { recursive: false }).catch(() => {});
            }

            alert("🗑️ Local database successfully purged from browser storage! Reloading page to build a fresh instance...");
            window.location.reload();
        } catch (err) {
            console.error("❌ Failed to purge local file handle:", err);
            alert(`Purge failed: ${err.message}`);
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    const tx = document.getElementById("chatInput");   
    if (tx) {
        tx.addEventListener("input", autoGrowTextArea, false);
    }
    function autoGrowTextArea() {
        this.style.height = "auto";
        this.style.height = (this.scrollHeight) + "px";
    }
});