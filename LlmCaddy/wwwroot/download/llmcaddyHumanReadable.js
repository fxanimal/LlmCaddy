importScripts("/download/sqlite3.js");

let db = null;
let sqlite3 = null;

const initSQLite = async () => {
    try {
        // Debug Check: Verify the header isolation context inside the worker itself
        console.log("🔒 [Worker] crossOriginIsolated state:", self.crossOriginIsolated);

        sqlite3 = await self.sqlite3InitModule({
            print: console.log,
            printErr: console.error
        });
        
        const dbName = "llmcaddy.db";
        
        // Fix: Query the special 'capi' (C-API) or 'oo1' nested sub-property if root 'opfs' is delayed
        const hasOpfs = ("opfs" in sqlite3) || (sqlite3.oo1 && "OpfsDb" in sqlite3.oo1);

        if (hasOpfs) {
            // Note: The official recommendation for OpfsDb is a virtual path absolute identifier
            db = new sqlite3.oo1.OpfsDb(`/${dbName}`);
            console.log(`💾 [Worker] Persistent OPFS Database successfully active at: ${db.filename}`);
        } else {
            db = new sqlite3.oo1.DB(dbName, "ct");
            console.warn("⚠️ [Worker] OPFS unavailable via SQLite subsystem hooks. Falling back to transient in-memory storage.");
        }
        
        self.postMessage({ type: "STATUS_READY" });
    } catch (err) {
        console.error("❌ [Worker] Initialization error:", err);
        self.postMessage({ type: "STATUS_ERROR", error: `WASM Boot Failure: ${err.message}` });
    }
};

self.onmessage = async (event) => {
    const { type, sql, bind, correlationId } = event.data;

    if (type === "INIT") {
        await initSQLite();
        return;
    }

    if (type === "EXEC_SQL") {
        if (!db) {
            self.postMessage({ 
                type: "QUERY_ERROR", 
                error: "Database has not been initialized yet.", 
                correlationId 
            });
            return;
        }

        try {
            const rows = [];
            db.exec({
                sql: sql,
                bind: bind || [],
                rowMode: "object",
                callback: (row) => { rows.push(row); }
            });

            self.postMessage({ 
                type: "QUERY_SUCCESS", 
                rows: rows, 
                correlationId 
            });
        } catch (err) {
            console.error("[Worker] Query error:", err);
            self.postMessage({ 
                type: "QUERY_ERROR", 
                error: err.message, 
                correlationId 
            });
        }
    }
};