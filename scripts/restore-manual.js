import ftp from 'basic-ftp';
import path from 'path';
import fs from 'fs';

async function restore() {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        await client.access({
            host: "uin.lny.mybluehost.me", port: 21,
            user: "ZTOWN@uin.lny.mybluehost.me", password: "1dellaMuckle-0rca",
            secure: false
        });

        console.log("🚀 AGGRESSIVE RESTORATION STARTING...");
        
        async function wipePath(remotePath) {
            try {
                const list = await client.list(remotePath);
                for (const item of list) {
                    if (item.name === "." || item.name === "..") continue;
                    const full = path.posix.join(remotePath, item.name);
                    if (item.type === 1) { // DIR
                        await wipePath(full);
                        await client.removeDir(full);
                    } else {
                        await client.remove(full);
                    }
                }
            } catch (e) { console.warn(`Wipe failed for ${remotePath}: ${e.message}`); }
        }

        console.log("🧹 Wiping root...");
        await wipePath("/");

        async function uploadRecursive(localPath, remotePath) {
            const stats = fs.statSync(localPath);
            if (stats.isDirectory()) {
                console.log(`📂 Ensuring DIR: ${remotePath}`);
                await client.ensureDir(remotePath);
                const files = fs.readdirSync(localPath);
                for (const file of files) {
                    await uploadRecursive(path.join(localPath, file), path.posix.join(remotePath, file));
                }
            } else {
                console.log(`📤 Uploading FILE: ${remotePath}`);
                // If it exists as a DIR, remove it first
                try {
                    const dirCheck = await client.list(path.posix.dirname(remotePath));
                    const found = dirCheck.find(f => f.name === path.posix.basename(remotePath));
                    if (found && found.type === 1) {
                         console.warn(`⚠️ Path ${remotePath} is a DIR on remote but should be a FILE. Deleting...`);
                         await client.removeDir(remotePath);
                    }
                } catch(e){}
                await client.uploadFrom(localPath, remotePath);
            }
        }

        // 1. Restore ztown.space root
        console.log("--- Sites ---");
        const ztownFiles = fs.readdirSync("C:\\Z\\LIVE\\ZTOWN");
        for (const f of ztownFiles) {
            await uploadRecursive(path.join("C:\\Z\\LIVE\\ZTOWN", f), `/${f}`);
        }

        // 2. website_* folders
        const mappings = [
            { folder: "website_f4ed6cb8", source: "c:\\Z\\8wut\\dist" },
            { folder: "website_22e3bccb", source: "C:\\Z\\LIVE\\VOICE OF THE WELL" },
            { folder: "website_d13ae7bf", source: "C:\\Z\\LIVE\\AInt" }
        ];
        for (const m of mappings) {
            await uploadRecursive(m.source, `/${m.folder}`);
            if (m.folder === "website_f4ed6cb8") {
                 await client.uploadFrom("c:\\Z\\8wut\\public\\.htaccess", "/website_f4ed6cb8/.htaccess");
            }
        }

        // 3. Other sub-folders
        const liveDir = "C:\\Z\\LIVE";
        const skip = ["ZTOWN", "VOICE OF THE WELL", "AInt"];
        const folders = fs.readdirSync(liveDir);
        for (const f of folders) {
            const full = path.join(liveDir, f);
            if (fs.statSync(full).isDirectory() && !skip.includes(f)) {
                let rName = f === "NPJAMZv2" ? "NPJAMZ" : f;
                await uploadRecursive(full, `/${rName}`);
            }
        }

        console.log("✅ SYSTEM FULLY RESTORED.");
    } catch (err) {
        console.error("❌ Fatal Error:", err);
    } finally {
        client.close();
    }
}
restore();
