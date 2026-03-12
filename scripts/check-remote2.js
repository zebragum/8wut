import ftp from 'basic-ftp';
import fs from 'fs';

async function run() {
    const client = new ftp.Client();
    try {
        await client.access({
            host: "uin.lny.mybluehost.me",
            port: 21,
            user: "ZTOWN@uin.lny.mybluehost.me",
            password: "1dellaMuckle-0rca",
            secure: false
        });
        await client.cd('/website_f4ed6cb8');
        const list = await client.list();
        let out = '';
        for(const item of list) {
            out += `${item.type} | ${JSON.stringify(item.name)} | ${item.size} bytes\n`;
        }
        fs.writeFileSync('remote-list.txt', out);
    } catch (e) {
        console.error(e);
    } finally {
        client.close();
    }
}
run();
