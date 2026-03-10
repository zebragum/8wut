import ftp from 'basic-ftp';
import path from 'path';
import fs from 'fs';

async function restore() {
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

        console.log("🚀 Connected to Bluehost for full restoration!");
        await client.cd("/");
        
        // 1. CLEAR EVERYTHING FIRST to avoid messy overlaps
        console.log("🧹 Clearing remote directory for a clean slate...");
        const list = await client.list();
        for (const item of list) {
            if (item.name === "." || item.name === "..") continue;
            try {
                if (item.type === 1) await client.removeDir(item.name);
                else await client.remove(item.name);
            } catch (e) {
                console.warn(`Could not delete ${item.name}: ${e.message}`);
            }
        }
        console.log("✨ Remote directory cleared.");

        // 2. RESTORE ztown.space root (from C:\Z\LIVE\ZTOWN)
        console.log("📂 Restoring ztown.space root files...");
        const ztownRoot = "C:\\Z\\LIVE\\ZTOWN";
        await client.uploadFromDir(ztownRoot, "/");

        // 3. RESTORE other LIFE folders
        const liveDir = "C:\\Z\\LIVE";
        const items = fs.readdirSync(liveDir);
        for (const item of items) {
            const fullPath = path.join(liveDir, item);
            if (fs.statSync(fullPath).isDirectory()) {
                if (item === "ZTOWN") continue; // Already handled as root
                
                let remoteName = item;
                if (item === "NPJAMZv2") remoteName = "NPJAMZ";
                
                console.log(`📂 Restoring folder: ${item} -> /${remoteName}`);
                await client.ensureDir(`/${remoteName}`);
                await client.uploadFromDir(fullPath, `/${remoteName}`);
            }
        }

        // 4. DEPLOY 8wut to its own folder
        console.log("🚀 Deploying 8wut to /8wut...");
        const wutDist = "c:\\Z\\8wut\\dist";
        if (fs.existsSync(wutDist)) {
            await client.ensureDir("/8wut");
            await client.uploadFromDir(wutDist, "/8wut");
            
            // Add .htaccess for 8wut SPA routing if mapped to 8wut.org
            const htaccessPath = "c:\\Z\\8wut\\public\\.htaccess";
            if (fs.existsSync(htaccessPath)) {
                await client.uploadFrom(htaccessPath, "/8wut/.htaccess");
            }
        }

        console.log("✅ FULL RESTORATION COMPLETE!");
        console.log("🔗 ztown.space should be back.");
        console.log("🔗 8wut should be at /8wut.");

    } catch (err) {
        console.error("❌ Restoration failed:", err);
    } finally {
        client.close();
    }
}

restore();
