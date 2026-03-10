import ftp from 'basic-ftp';
import path from 'path';

async function debug() {
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
        console.log("📂 Root listing:");
        const list = await client.list("/");
        for (const item of list) {
            const type = item.type === 1 ? "DIR " : "FILE";
            console.log(`${type} ${item.name.padEnd(20)} ${item.size}`);
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.close();
    }
}
debug();
