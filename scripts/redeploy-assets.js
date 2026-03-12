import ftp from 'basic-ftp';
import path from 'path';

const FTP_CONFIG = {
    host: "uin.lny.mybluehost.me",
    port: 21,
    user: "ZTOWN@uin.lny.mybluehost.me",
    password: "1dellaMuckle-0rca",
    secure: false
};

async function uploadOne(local, remote) {
    const client = new ftp.Client(60000); // 60s timeout
    try {
        await client.access(FTP_CONFIG);
        await client.uploadFrom(local, remote);
        console.log(`✅ Uploaded ${remote}`);
    } catch (err) {
        console.error(`❌ Failed ${remote}: ${err.message}`);
    } finally {
        client.close();
    }
}

async function run() {
    console.log("🚀 Starting surgical asset re-upload...");
    
    const css = "dist/assets/index-Bn95nioD.css";
    const js = "dist/assets/index-DnXf_f3t.js";
    
    await uploadOne(path.resolve(css), "/website_f4ed6cb8/assets/index-Bn95nioD.css");
    await uploadOne(path.resolve(js), "/website_f4ed6cb8/assets/index-DnXf_f3t.js");
    
    console.log("🏁 Surgical re-upload finished.");
}

run();
