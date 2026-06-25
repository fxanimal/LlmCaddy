const coreProviders = [
    { id: 'openai', name: 'ChatGPT' },
    { id: 'anthropic', name: 'Claude' },
    { id: 'google', name: 'Gemini' },
    { id: 'groq', name: 'Groq' },
    { id: 'mistral', name: 'Mistral' },
    { id: 'cohere', name: 'Cohere' },
    { id: 'deepseek', name: 'DeepSeek' }
];

let selectedProviders = new Set();
let allLoadedProviders = []; 

document.addEventListener('DOMContentLoaded', async () => {
    // Await database initialization confirmation or short timeout fallback
    setTimeout(async () => {
        await renderAllBadges();
    }, 400);

    const input = document.getElementById('chatInput');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendQuery();
            }
        });
    }
});

async function renderAllBadges() {
    const container = document.getElementById('model-badges');
    if (!container) return;
    container.innerHTML = '';

    // Initialize list with core configurations
    allLoadedProviders = [...coreProviders];

    // Read custom additions from local SQLite
    if (typeof dbClient !== 'undefined' && dbClient.isReady) {
        try {
            const res = await dbClient.execute("SELECT Id, DisplayName FROM CustomProviders");
            if (res && res.rows) {
                res.rows.forEach(row => {
                    allLoadedProviders.push({ id: row[0], name: row[1], isCustom: true });
                });
            }
        } catch (err) {
            console.error("Could not load custom entries yet:", err);
        }
    }

    // Append layouts to DOM
    allLoadedProviders.forEach(p => {
        const badgeHtml = `
            <div class="relative group flex items-center">
                <span id="badge-${p.id}" onclick="selectModel('${p.name}', '${p.id}')" 
                      class="cursor-pointer px-2 py-1 rounded bg-slate-200 text-slate-600 text-xs font-medium transition-all select-none">
                    ${p.name}
                </span>
                <button onclick="openSettingsModal('${p.id}', ${p.isCustom || false})" 
                        class="ml-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-orange-500 transition-opacity text-xs p-0.5">
                    ⚙️
                </button>
            </div>`;
        container.insertAdjacentHTML('beforeend', badgeHtml);
        refreshBadgeUI(p.id);
    });
}

function refreshBadgeUI(providerId) {
    const badge = document.getElementById(`badge-${providerId}`);
    if (!badge) return;

    const storageKey = `llmcaddy_api_key_${providerId}`;
    const keyVal = localStorage.getItem(storageKey);
    const hasKey = keyVal !== null && keyVal.trim().length > 0;
    const isActive = selectedProviders.has(providerId);

    badge.style.transition = "all 0.2s ease";

    if (isActive) {
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

function selectModel(modelName, providerId) {
    if (selectedProviders.has(providerId)) {
        selectedProviders.delete(providerId);
    } else {
        // Enforce single active selection paradigm
        selectedProviders.clear();
        selectedProviders.add(providerId);
    }
    allLoadedProviders.forEach(p => refreshBadgeUI(p.id));
}

async function openSettingsModal(providerId = null, isCustom = false) {
    const oldModal = document.getElementById('settings-modal-wrapper');
    if (oldModal) oldModal.remove();

    let displayName = '';
    let apiKey = '';
    let customUrl = '';
    let customModel = '';

    if (providerId) {
        apiKey = localStorage.getItem(`llmcaddy_api_key_${providerId}`) || '';

        if (!isCustom) {
            const core = coreProviders.find(c => c.id === providerId);
            displayName = core ? core.name : providerId;
        } else if (typeof dbClient !== 'undefined' && dbClient.isReady) {
            const res = await dbClient.execute("SELECT DisplayName, BaseUrl, DefaultModel FROM CustomProviders WHERE Id = ?", [providerId]);
            if (res && res.rows && res.rows.length > 0) {
                displayName = res.rows[0][0];
                customUrl = res.rows[0][1];
                customModel = res.rows[0][2];
            }
        }
    }

    // 2. Create a structural full-screen background overlay wrapper
    const modalWrapper = document.createElement('div');
    modalWrapper.id = 'settings-modal-wrapper';
    // Fixed high z-index overlay that locks to the browser screen view bounds
    modalWrapper.className = "fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4";

    modalWrapper.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col transform scale-100 transition-all duration-200">
            <div class="p-6 flex flex-col w-full">
                
                <div class="text-center mb-5">
                    <h3 class="text-lg font-bold text-slate-800">${providerId ? 'Modify ' + displayName : 'Add Custom LLM Endpoint'}</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Configuration details are stored within your client sandbox environment.</p>
                </div>
                
                <div class="space-y-4 mb-6">
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 mb-1">Display Name</label>
                        <input type="text" id="modalName" value="${displayName}" ${providerId && !isCustom ? 'disabled' : ''} 
                               class="w-full p-2.5 text-sm border rounded-lg bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="e.g., Local Ollama">
                    </div>

                    ${(!providerId || isCustom) ? `
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 mb-1">Base API Gateway Endpoint URL</label>
                        <input type="text" id="modalUrl" value="${customUrl}" 
                               class="w-full p-2.5 text-sm border rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="https://localhost:11434/v1">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 mb-1">Target Identity Model Identifier ID</label>
                        <input type="text" id="modalModel" value="${customModel}" 
                               class="w-full p-2.5 text-sm border rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="llama3:latest">
                    </div>
                    ` : ''}

                    <div>
                        <label class="block text-xs font-semibold text-slate-500 mb-1">Secret Provider API Key Authentication Token</label>
                        <input type="password" id="modalKey" value="${apiKey}" 
                               class="w-full p-2.5 text-sm border rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="sk-...">
                    </div>
                </div>

                <div class="flex items-center justify-between w-full pt-4 border-t border-slate-100">
                    <div class="flex-1 text-left">
                        ${providerId ? `
                            <button id="modalDeleteBtn" type="button" class="px-3 py-2 text-sm font-semibold text-red-600 rounded-lg bg-red-50 hover:bg-red-100 transition-colors border-none cursor-pointer">
                                Remove
                            </button>
                        ` : ''}
                    </div>
                    <div class="flex items-center gap-2 justify-end">
                        <button id="modalCloseBtn" type="button" class="px-4 py-2 text-sm font-semibold text-slate-600 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors border-none cursor-pointer">
                            Cancel
                        </button>
                        <button id="modalSaveBtn" type="button" class="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-orange-500 hover:bg-orange-600 transition-colors border-none cursor-pointer">
                            Save
                        </button>
                    </div>
                </div>

            </div>
        </div>
    `;

    document.body.appendChild(modalWrapper);

    // 1. SAVE REGISTRATION DISPATCHER
    modalWrapper.querySelector('#modalSaveBtn').onclick = async () => {
        const key = modalWrapper.querySelector('#modalKey').value.trim();
        const name = modalWrapper.querySelector('#modalName').value.trim();
        let activeId = providerId;

        if (!activeId) {
            activeId = 'custom-' + Date.now();
            const url = modalWrapper.querySelector('#modalUrl').value.trim();
            const model = modalWrapper.querySelector('#modalModel').value.trim();

            if (!name || !url || !model) {
                alert("Please fill in all endpoint details.");
                return;
            }

            if (typeof dbClient !== 'undefined' && dbClient.isReady) {
                await dbClient.execute("INSERT INTO CustomProviders (Id, DisplayName, BaseUrl, DefaultModel) VALUES (?, ?, ?, ?)", [activeId, name, url, model]);
            }
        } else if (isCustom) {
            const url = modalWrapper.querySelector('#modalUrl').value.trim();
            const model = modalWrapper.querySelector('#modalModel').value.trim();
            if (typeof dbClient !== 'undefined' && dbClient.isReady) {
                await dbClient.execute("UPDATE CustomProviders SET DisplayName = ?, BaseUrl = ?, DefaultModel = ? WHERE Id = ?", [name, url, model, activeId]);
            }
        }

        if (key.length > 0) {
            localStorage.setItem(`llmcaddy_api_key_${activeId}`, key);
        } else {
            localStorage.removeItem(`llmcaddy_api_key_${activeId}`);
        }

        modalWrapper.remove();
        await renderAllBadges();
    };

    // 2. REMOVE SELECTION DISPATCHER
    if (providerId) {
        modalWrapper.querySelector('#modalDeleteBtn').onclick = async () => {
            if (confirm(`Are you sure you want to permanently remove ${displayName}?`)) {
                if (isCustom) {
                    if (typeof dbClient !== 'undefined' && dbClient.isReady) {
                        await dbClient.execute("DELETE FROM CustomProviders WHERE Id = ?", [providerId]);
                    }
                } else {
                    if (typeof dbClient !== 'undefined' && dbClient.isReady) {
                        await dbClient.execute("INSERT OR IGNORE INTO HiddenCoreProviders (ProviderId) VALUES (?)", [providerId]);
                    }
                }
                localStorage.removeItem(`llmcaddy_api_key_${providerId}`);
                selectedProviders.delete(providerId);
                modalWrapper.remove();
                await renderAllBadges();
            }
        };
    }

    // 3. CANCEL AND CLOSE HANDLERS
    modalWrapper.querySelector('#modalCloseBtn').onclick = () => modalWrapper.remove();
}

function openCustomProviderSettings() {
    openSettingsModal(null, true);
}

async function handleSendQuery() {
    const inputEl = document.getElementById('chatInput');
    if (!inputEl) return;

    const query = inputEl.value.trim();
    if (!query) return;

    const activeProviderId = selectedProviders.size > 0 ? Array.from(selectedProviders)[0] : "none";
    const apiKey = activeProviderId !== "none" ? localStorage.getItem(`llmcaddy_api_key_${activeProviderId}`) : "";

    let customBaseUrl = "";
    let customModel = "";
    const isCore = coreProviders.some(c => c.id === activeProviderId);

    if (activeProviderId !== "none" && !isCore && typeof dbClient !== 'undefined' && dbClient.isReady) {
        const res = await dbClient.execute("SELECT BaseUrl, DefaultModel FROM CustomProviders WHERE Id = ?", [activeProviderId]);
        if (res && res.rows && res.rows.length > 0) {
            customBaseUrl = res.rows[0][0];
            customModel = res.rows[0][1];
        }
    }

    const redactedQuery = query
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED-SSN/SIN]")
        .replace(/\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/g, "[REDACTED-EMAIL]");

    inputEl.value = '';
    appendMessageToUI('user', query);

    const aiBubbleId = 'ai-' + Date.now();
    appendMessageToUI('llmcaddy', 'Thinking...', aiBubbleId);

    try {
        const response = await fetch('/Chat/StreamResponse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Prompt: redactedQuery,
                Provider: activeProviderId,
                ApiKey: apiKey,
                CustomBaseUrl: customBaseUrl,
                CustomModel: customModel
            })
        });

        if (!response.ok) throw new Error("Server network pipeline failure.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let completeText = '';
        const aiTargetDiv = document.getElementById(aiBubbleId);
        if (aiTargetDiv) aiTargetDiv.innerHTML = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            completeText += chunk;

            if (aiTargetDiv) aiTargetDiv.textContent = completeText;
        }

        if (typeof dbClient !== 'undefined' && dbClient.isReady) {
            const currentModelName = allLoadedProviders.find(p => p.id === activeProviderId)?.name || "Smart-Route";
            dbClient.execute(
                "INSERT INTO ChatHistory (SessionId, LLMName, UserQuery, SystemResponse, Condensed) VALUES (?, ?, ?, ?, ?)",
                [self.crypto.randomUUID(), currentModelName, redactedQuery, completeText, redactedQuery.substring(0, 30) + '...']
            );
        }

    } catch (err) {
        console.error(err);
        const target = document.getElementById(aiBubbleId);
        if (target) target.textContent = `Error calling model: ${err.message}`;
    }
}

function appendMessageToUI(sender, text, customizedId = null) {
    const chatContainer = document.querySelector('section > div.space-y-8');
    if (!chatContainer) return;

    const wrapper = document.createElement('div');
    if (sender === 'user') {
        wrapper.className = "flex justify-end gap-3";
        wrapper.innerHTML = `<div class="bg-blue-600 text-white p-4 rounded-2xl rounded-tr-none text-sm max-w-2xl">${text.replace(/</g, "&lt;")}</div>`;
    } else {
        wrapper.className = "flex justify-start gap-3";
        wrapper.innerHTML = `
            <div class="bg-white border p-5 rounded-2xl rounded-tl-none text-sm w-full">
                <p class="font-semibold text-xs text-slate-400 mb-2">LlmCaddy</p>
                <div id="${customizedId || ''}" class="whitespace-pre-wrap">${text}</div>
            </div>`;
    }
    chatContainer.appendChild(wrapper);
    wrapper.scrollIntoView({ behavior: 'smooth' });
}