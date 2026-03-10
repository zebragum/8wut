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

        console.log("🚀 OPTIMIZED RESTORATION STARTING...");
        
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

        const skipList = ["node_modules", ".git", ".DS_Store", "dist", ".vite"];

        async function uploadRecursive(localPath, remotePath) {
            if (!fs.existsSync(localPath)) return;
            const name = path.basename(localPath);
            if (skipList.includes(name)) {
                console.log(`⏩ Skipping ${localPath}`);
                return;
            }

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
                await client.uploadFrom(localPath, remotePath);
            }
        }

        // 1. ztown.space root
        console.log("--- [1] ztown.space Root ---");
        const ztownRoot = "C:\\Z\\LIVE\\ZTOWN";
        const ztownFiles = fs.readdirSync(ztownRoot);
        for (const f of ztownFiles) {
            await uploadRecursive(path.join(ztownRoot, f), `/${f}`);
        }

        // 2. Small sub-folders (PRIORITY)
        console.log("--- [2] Prioritizing Sub-folders ---");
        const subMappings = {
            "3rdear": "Third Ear",
            "NPJAMZ": "NPJAMZv2",
            "cozmiccouch": "COZMICCOUCH",
            "ZeroStandardTime": "ZEROSTANDARDTIME",
            "GRAVITYZONE": "GRAVITYZONE",
            "zlog": "ZLOG",
            "Cloudburst": "Cloudburst",
            "HEARTBEATANALYZER": "HEARTBEATANALYZER"
        };
        for (const [remote, local] of Object.entries(subMappings)) {
            await uploadRecursive(path.join("C:\\Z\\LIVE", local), `/${remote}`);
        }

        // 3. 8wut (website_f4ed6cb8)
        console.log("--- [3] Uploading 8wut.org ---");
        // For 8wut, we DO want to upload the dist folder contents, but we pass 'source' as the dist folder itself.
        await uploadRecursive("c:\\Z\\8wut\\dist", "/website_f4ed6cb8");
        await client.uploadFrom("c:\\Z\\8wut\\public\\.htaccess", "/website_f4ed6cb8/.htaccess");

        // 4. Voice of the Well
        console.log("--- [4] Uploading VOICE OF THE WELL ---");
        await uploadRecursive("C:\\Z\\LIVE\\VOICE OF THE WELL", "/website_22e3bccb");

        // 5. Massive AInt (LAST)
        console.log("--- [5] Finally Uploading AInt ---");
        await uploadRecursive("C:\\Z\\LIVE\\AInt", "/website_d13ae7bf");

        console.log("✅ RESTORATION COMPLETE.");
    } catch (err) {
        console.error("❌ Fatal Error:", err);
    } finally {
        client.close();
    }
}
restore();
