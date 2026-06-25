class SQLiteClient {
    constructor() {
        this.worker = new Worker('/download/llmcaddy.js?sqlite3.dir=/download');
        this.resolvers = new Map();
        this.rejecters = new Map();
        this.isReady = false;
        this._readyPromise = new Promise((resolve) => {
            this._resolveReady = resolve;
        });
        this.init();
    }

    init() {
        this.worker.onmessage = (event) => {
            const { type, rows, error, correlationId, success } = event.data;
            const alertBox = document.getElementById('db-error-alert');

            switch (type) {
                case 'STATUS_READY':
                    this.isReady = true;
                    if (alertBox) alertBox.classList.add('hidden');
                    console.log('✅ [SQLiteClient] WASM Loaded & OPFS Connected.');
                    this._resolveReady(); 
                    break;

                case 'STATUS_ERROR':
                    console.error('❌ [SQLiteClient] Core DB failure:', error);
                    if (alertBox) {
                        alertBox.textContent = `Database initialization failure: ${error}`;
                        alertBox.classList.remove('hidden');
                    }
                    break;

                case 'QUERY_SUCCESS':
                    if (this.resolvers.has(correlationId)) {
                        this.resolvers.get(correlationId)(rows);
                        this.cleanupTransaction(correlationId);
                    }
                    break;

                case 'QUERY_ERROR':
                    if (this.rejecters.has(correlationId)) {
                        this.rejecters.get(correlationId)(new Error(error));
                        this.cleanupTransaction(correlationId);
                    }
                    break;

                // 🌟 NEW: Listen for the worker's completion response during self-repair loops
                case 'RESET_COMPLETE':
                    if (this.resolvers.has(correlationId)) {
                        if (success) {
                            this.resolvers.get(correlationId)(true);
                        } else {
                            this.rejecters.get(correlationId)(new Error(error || "Worker failed to clear database file handle context."));
                        }
                        this.cleanupTransaction(correlationId);
                    }
                    break;
            }
        };
        this.worker.postMessage({ type: 'INIT' });
    }

    ensureReady() {
        return this._readyPromise;
    }

    query(sql, bind = []) {
        return new Promise((resolve, reject) => {
            const correlationId = crypto.randomUUID();
            this.resolvers.set(correlationId, resolve);
            this.rejecters.set(correlationId, reject);
            this.worker.postMessage({
                type: 'EXEC_SQL',
                sql,
                bind,
                correlationId
            });
        });
    }

    // 🌟 NEW: Instructs the background worker thread to safely close SQLite handles and purge the locked database file
    forcePurgeLockedDatabase() {
        return new Promise((resolve, reject) => {
            const correlationId = crypto.randomUUID();
            this.resolvers.set(correlationId, resolve);
            this.rejecters.set(correlationId, reject);
            
            console.log("📤 [SQLiteClient] Deselecting active layout handles. Shipping recovery sequence payload to worker thread...");
            this.worker.postMessage({
                type: 'FORCE_RESET_DB',
                correlationId
            });
        });
    }

    cleanupTransaction(id) {
        this.resolvers.delete(id);
        this.rejecters.delete(id);
    }
}

export const dbClient = new SQLiteClient();

async function manageChatLog() {
    await dbClient.query(`
        CREATE TABLE IF NOT EXISTS ChatLogs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt TEXT NOT NULL,
            response TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    await dbClient.query(
        "INSERT INTO ChatLogs (prompt, response) VALUES (?, ?);",
        ["Hello Local DB!", "Hi there, I am running completely out of your local OPFS storage!"]
    );
    const history = await dbClient.query("SELECT * FROM ChatLogs ORDER BY timestamp DESC;");
    console.log("Retrieved Records from SQLite:", history);
}