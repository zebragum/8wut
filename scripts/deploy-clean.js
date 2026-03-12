import ftp from 'basic-ftp';
import path from 'path';
import fs from 'fs';

const FTP_CONFIG = {
    host: "uin.lny.mybluehost.me",
    port: 21,
    user: "ZTOWN@uin.lny.mybluehost.me",
    password: "1dellaMuckle-0rca",
    secure: false,
};

const REMOTE_DIR = "/website_f4ed6cb8";
const LOCAL_DIST = path.resolve("dist");

async function deploy() {
    const client = new ftp.Client(120000); // 120s timeout
    client.ftp.verbose = true;
    try {
        await client.access(FTP_CONFIG);
        console.log("Connected to Bluehost.");

        // 1. WIPE ASSETS
        console.log("🧹 Wiping remote assets...");
        try {
            await client.cd(`${REMOTE_DIR}/assets`);
            const list = await client.list();
            for (const item of list) {
                if (item.name === "." || item.name === "..") continue;
                await client.remove(item.name);
                console.log(`🗑 Removed asset: ${item.name}`);
            }
        } catch (e) {
            console.warn("Could not wipe assets or directory missing:", e.message);
        }

        // 2. UPLOAD EVERYTHING FROM DIST
        console.log("📤 Uploading from dist...");
        async function uploadRecursive(localPath, remotePath) {
            const stats = fs.statSync(localPath);
            if (stats.isDirectory()) {
                await client.ensureDir(remotePath);
                const files = fs.readdirSync(localPath);
                for (const file of files) {
                    await uploadRecursive(path.join(localPath, file), path.posix.join(remotePath, file));
                }
            } else {
                console.log(`Uploading: ${path.basename(localPath)} (${stats.size} bytes)`);
                await client.uploadFrom(localPath, remotePath);
            }
        }

        await uploadRecursive(LOCAL_DIST, REMOTE_DIR);

        // 3. UPLOAD .htaccess
        const htaccess = path.resolve("public/.htaccess");
        if (fs.existsSync(htaccess)) {
            console.log("📤 Uploading .htaccess");
            await client.uploadFrom(htaccess, `${REMOTE_DIR}/.htaccess`);
        }

        console.log("✅ DEPLOYMENT SUCCESSFUL!");
    } catch (err) {
        console.error("❌ DEPLOYMENT FAILED:", err);
    } finally {
        client.close();
    }
}

deploy();
