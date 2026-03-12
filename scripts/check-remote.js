import ftp from 'basic-ftp';

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
        console.log('--- FILES ---');
        for(const item of list) {
            console.log(`${item.type === 1 ? 'DIR ' : 'FILE'} ${item.name} (${item.size} bytes)`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.close();
    }
}
run();
