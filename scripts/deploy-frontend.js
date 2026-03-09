import ftp from 'basic-ftp';
import path from 'path';
import fs from 'fs';

async function deploy() {
    const client = new ftp.Client();
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
        
        // Ensure we're in the right directory (usually starts in public_html for this user)
        const remoteRoot = "/";
        await client.cd(remoteRoot);
        console.log("📂 Current remote directory:", await client.pwd());

        // Clear everything in public_html EXCEPT potentially system files if needed, 
        // but user wanted a clean slate. Let's list and delete.
        const list = await client.list();
        for (const item of list) {
            if (item.name === "." || item.name === "..") continue;
            try {
                if (item.type === 1) { // Directory
                    await client.removeDir(item.name);
                } else {
                    await client.remove(item.name);
                }
            } catch (e) {
                console.warn(`Could not delete ${item.name}:`, e.message);
            }
        }

        console.log("🧹 Remote directory cleared!");

        // Upload local dist folder contents
        const localDist = path.resolve("dist");
        await client.uploadFromDir(localDist);

        console.log("✅ Deployment successful! 8wut.org is updated.");
    } catch (err) {
        console.error("❌ Deployment failed:", err);
    } finally {
        client.close();
    }
}

deploy();
