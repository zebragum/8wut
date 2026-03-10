import ftp from 'basic-ftp';
import path from 'path';
import fs from 'fs';

async function deploy8wut() {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        await client.access({
            host: "uin.lny.mybluehost.me", port: 21,
            user: "ZTOWN@uin.lny.mybluehost.me", password: "1dellaMuckle-0rca",
            secure: false
        });

        console.log("🚀 DEPLOYING 8WUT.ORG ONLY...");
        
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

        console.log("🧹 Wiping /website_f4ed6cb8 (8wut)...");
        try {
            await wipePath("/website_f4ed6cb8");
        } catch (e){}

        async function uploadRecursive(localPath, remotePath) {
            if (!fs.existsSync(localPath)) return;
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

        console.log("--- Uploading 8wut.org ---");
        await uploadRecursive("c:\\Z\\8wut\\dist", "/website_f4ed6cb8");
        await client.uploadFrom("c:\\Z\\8wut\\public\\.htaccess", "/website_f4ed6cb8/.htaccess");

        console.log("✅ 8WUT DEPLOYMENT COMPLETE.");
    } catch (err) {
        console.error("❌ Fatal Error:", err);
    } finally {
        client.close();
    }
}
deploy8wut();
