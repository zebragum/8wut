import ftp from 'basic-ftp';
import path from 'path';

const FTP_CONFIG = {
    host: "uin.lny.mybluehost.me",
    port: 21,
    user: "ZTOWN@uin.lny.mybluehost.me",
    password: "1dellaMuckle-0rca",
    secure: false
};

async function uploadJS() {
    const client = new ftp.Client(90000); // 90s timeout
    client.ftp.verbose = true;
    try {
        await client.access(FTP_CONFIG);
        const local = path.resolve("dist/assets/index-DnXf_f3t.js");
        const remote = "/website_f4ed6cb8/assets/index-DnXf_f3t.js";
        
        console.log(`📤 Uploading JS: ${local} -> ${remote}`);
        await client.uploadFrom(local, remote);
        console.log("✅ JS Upload successful!");
    } catch (err) {
        console.error("❌ JS Upload failed:", err);
    } finally {
        client.close();
    }
}

uploadJS();
