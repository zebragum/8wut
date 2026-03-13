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

        console.log("🚀 Connected to Bluehost (Staging)!");
        // The staging folder inside the public_html equivalent
        const remoteStagingDir = "/staging.8wut.org";
        
        // Ensure the staging directory exists
        await client.ensureDir(remoteStagingDir);
        await client.cd(remoteStagingDir);
        
        // 1. CLEAR STAGING DIRECTORY
        console.log("🧹 Clearing remote staging directory...");
        const list = await client.list();
        for (const item of list) {
            if (item.name === "." || item.name === "..") continue;
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
                    console.log(`📤 Uploading file: ${file}`);
                    await client.uploadFrom(localFile, remoteFile);
                }
            }
        }

        await uploadDir(distPath, remoteStagingDir);

        // 3. UPLOAD .htaccess from public (just in case dist didn't have it)
        const htaccessPath = path.resolve("public/.htaccess");
        if (fs.existsSync(htaccessPath)) {
            console.log("📤 Uploading .htaccess explicitly...");
            await client.uploadFrom(htaccessPath, `${remoteStagingDir}/.htaccess`);
        }

        console.log("✅ Staging Deployment successful! Site should be available at staging.8wut.org");
    } catch (err) {
        console.error("❌ Staging Deployment failed:", err);
    } finally {
        client.close();
    }
}

deploy();
