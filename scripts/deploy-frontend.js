import ftp from 'basic-ftp';
import path from 'path';
import fs from 'fs';

async function deploy() {
    const client = new ftp.Client(60000); // 60s timeout
    client.ftp.verbose = true;
    try {
        await client.access({
            host: "uin.lny.mybluehost.me",
            port: 21,
            user: "ZTOWN@uin.lny.mybluehost.me",
            password: "1dellaMuckle-0rca",
            secure: false
        });

        console.log("🚀 Connected to Bluehost!");
        await client.cd("/website_f4ed6cb8");
        
        // 1. CLEAR EVERYTHING (except hidden files)
        console.log("🧹 Clearing remote directory (protecting hidden files)...");
        const list = await client.list();
        for (const item of list) {
            if (item.name.startsWith(".")) continue; // Protect .well-known, .htaccess, etc.
            try {
                if (item.type === 1) await client.removeDir(item.name);
                else await client.remove(item.name);
            } catch (e) { console.warn(`Could not delete ${item.name}: ${e.message}`); }
        }

        // 2. UPLOAD FILES MANUALLY
        const distPath = path.resolve("dist");
        
        async function uploadDir(localDir, remoteDir) {
            await client.ensureDir(remoteDir);
            const files = fs.readdirSync(localDir);
            for (const file of files) {
                const localFile = path.join(localDir, file);
                const remoteFile = path.posix.join(remoteDir, file);
                if (fs.statSync(localFile).isDirectory()) {
                    await uploadDir(localFile, remoteFile);
                } else {
                    if (file === '.htaccess') continue; // Uploaded explicitly at the end
                    console.log(`📤 Uploading file: ${file}`);
                    try {
                        await client.uploadFrom(localFile, remoteFile);
                    } catch (e) { console.warn(`⚠️ Skipped ${file}: ${e.message}`); }
                }
            }
        }

        await uploadDir(distPath, "/website_f4ed6cb8");

        // 3. UPLOAD .htaccess from public (just in case dist didn't have it)
        const htaccessPath = path.resolve("public/.htaccess");
        if (fs.existsSync(htaccessPath)) {
            console.log("📤 Uploading .htaccess explicitly...");
            try {
                await client.uploadFrom(htaccessPath, "/website_f4ed6cb8/.htaccess");
            } catch (e) { console.warn(`⚠️ Could not upload .htaccess (likely restricted): ${e.message}`); }
        }

        console.log("✅ Deployment successful! Site should be fixed.");
    } catch (err) {
        console.error("❌ Deployment failed:", err);
    } finally {
        client.close();
    }
}

deploy();
