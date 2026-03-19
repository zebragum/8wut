import ftp from 'basic-ftp';
import path from 'path';

const FTP_CONFIG = {
    host: "uin.lny.mybluehost.me",
    port: 21,
    user: "ZTOWN@uin.lny.mybluehost.me",
    password: "1dellaMuckle-0rca",
    secure: false
};

async function uploadFile(localPath, remotePath, retries = 5) {
    for (let i = 0; i < retries; i++) {
        const client = new ftp.Client(60000); // 60s timeout
        try {
            await client.access(FTP_CONFIG);
            await client.ensureDir(path.posix.dirname(remotePath));
            await client.uploadFrom(localPath, remotePath);
            console.log(`✅ Uploaded: ${remotePath}`);
            return;
        } catch (err) {
            console.error(`❌ Retry ${i+1}/${retries} Failed: ${localPath} - ${err.message}`);
            if (i === retries - 1) throw err;
        } finally {
            client.close();
        }
        await new Promise(r => setTimeout(r, 2000));
    }
}

async function main() {
    await uploadFile(
        path.resolve("dist/index.html"),
        "/website_f4ed6cb8/index.html"
    );
    await uploadFile(
        path.resolve("dist/assets/index-ud82U1gL.css"),
        "/website_f4ed6cb8/assets/index-ud82U1gL.css"
    );
    await uploadFile(
        path.resolve("dist/assets/index-DviWTcbs.js"),
        "/website_f4ed6cb8/assets/index-DviWTcbs.js"
    );
}

main();
