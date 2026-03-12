import ftp from 'basic-ftp';
import path from 'path';
import fs from 'fs';

const FTP_CONFIG = {
    host: "uin.lny.mybluehost.me",
    port: 21,
    user: "ZTOWN@uin.lny.mybluehost.me",
    password: "1dellaMuckle-0rca",
    secure: false
};
const REMOTE_ROOT = "/website_f4ed6cb8";
const LOCAL_DIST = path.resolve("dist");

// Collect all files from dist
function getAllFiles(dir, base = '') {
    let results = [];
    for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        const rel = base ? `${base}/${entry}` : entry;
        if (fs.statSync(full).isDirectory()) {
            results.push({ type: 'dir', rel });
            results = results.concat(getAllFiles(full, rel));
        } else {
            results.push({ type: 'file', rel, local: full });
        }
    }
    return results;
}

async function uploadWithRetry(entry, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const client = new ftp.Client(15000);
        try {
            await client.access(FTP_CONFIG);
            if (entry.type === 'dir') {
                await client.ensureDir(`${REMOTE_ROOT}/${entry.rel}`);
                console.log(`📂 DIR OK: ${entry.rel}`);
            } else {
                const remotePath = `${REMOTE_ROOT}/${entry.rel}`;
                // Ensure parent dir exists
                const parentDir = path.posix.dirname(remotePath);
                await client.ensureDir(parentDir);
                await client.uploadFrom(entry.local, remotePath);
                console.log(`✅ ${entry.rel} (attempt ${attempt})`);
            }
            client.close();
            return true;
        } catch (err) {
            console.warn(`⚠️ Attempt ${attempt} failed for ${entry.rel}: ${err.message}`);
            client.close();
            if (attempt === maxRetries) {
                console.error(`❌ FAILED after ${maxRetries} attempts: ${entry.rel}`);
                return false;
            }
            // Wait a bit before retry
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

async function main() {
    console.log("🚀 Resilient FTP Deploy starting...");
    const entries = getAllFiles(LOCAL_DIST);
    console.log(`Found ${entries.length} entries to upload`);

    let failed = [];
    // Upload directories first, then files
    const dirs = entries.filter(e => e.type === 'dir');
    const files = entries.filter(e => e.type === 'file');

    for (const dir of dirs) {
        const ok = await uploadWithRetry(dir);
        if (!ok) failed.push(dir.rel);
    }
    for (const file of files) {
        const ok = await uploadWithRetry(file);
        if (!ok) failed.push(file.rel);
    }

    // Also upload .htaccess
    const htaccess = path.resolve("public/.htaccess");
    if (fs.existsSync(htaccess)) {
        const ok = await uploadWithRetry({ type: 'file', rel: '.htaccess', local: htaccess });
        if (!ok) failed.push('.htaccess');
    }

    if (failed.length === 0) {
        console.log("\n🎉 ALL FILES DEPLOYED SUCCESSFULLY!");
    } else {
        console.error(`\n⚠️ ${failed.length} files failed:`, failed);
    }
}

main();
