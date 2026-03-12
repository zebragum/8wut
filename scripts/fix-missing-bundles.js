import ftp from 'basic-ftp';
import path from 'path';

const FTP_CONFIG = {
    host: "uin.lny.mybluehost.me",
    port: 21,
    user: "ZTOWN@uin.lny.mybluehost.me",
    password: "1dellaMuckle-0rca",
    secure: false
};

async function uploadFile(localPath, remotePath) {
    const client = new ftp.Client(60000); // 60s timeout
    try {
        await client.access(FTP_CONFIG);
        await client.ensureDir(path.posix.dirname(remotePath));
        await client.uploadFrom(localPath, remotePath);
        console.log(`✅ Uploaded: ${remotePath}`);
    } catch (err) {
        console.error(`❌ Failed: ${remotePath} - ${err.message}`);
    } finally {
        client.close();
    }
}

async function main() {
    // These two files failed during the resilient deploy
    await uploadFile(
        path.resolve("dist/assets/index-Bn95nioD.css"),
        "/website_f4ed6cb8/assets/index-Bn95nioD.css"
    );
    await uploadFile(
        path.resolve("dist/assets/index-DnXf_f3t.js"),
        "/website_f4ed6cb8/assets/index-DnXf_f3t.js"
    );
}

main();
