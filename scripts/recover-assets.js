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
const LOCAL_ASSETS = path.resolve("dist", "assets");

async function deploy() {
    const client = new ftp.Client(120000);
    client.ftp.verbose = true;
    try {
        await client.access(FTP_CONFIG);
        console.log("Connected to Bluehost.");

        console.log("📤 Surgically uploading assets...");
        await client.ensureDir(`${REMOTE_DIR}/assets`);
        const files = fs.readdirSync(LOCAL_ASSETS);
        for (const file of files) {
            console.log(`Uploading asset: ${file}`);
            await client.uploadFrom(path.join(LOCAL_ASSETS, file), `${REMOTE_DIR}/assets/${file}`);
        }

        console.log("📤 Uploading index.html and .htaccess...");
        await client.uploadFrom(path.resolve("dist/index.html"), `${REMOTE_DIR}/index.html`);
        await client.uploadFrom(path.resolve("public/.htaccess"), `${REMOTE_DIR}/.htaccess`);

        console.log("✅ RECOVERY SUCCESSFUL!");
    } catch (err) {
        console.error("❌ RECOVERY FAILED:", err);
    } finally {
        client.close();
    }
}

deploy();
