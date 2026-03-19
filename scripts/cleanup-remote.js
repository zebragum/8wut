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
        console.log("🗑 Emptying /assets directory to free space...");
        await client.cd('/website_f4ed6cb8/assets');
        const list = await client.list();
        for (const item of list) {
            console.log("Removing", item.name);
            await client.remove(item.name);
        }
        console.log("✅ Assets cleared.");
    } catch (e) {
        console.error("Cleanup failed:", e);
    } finally {
        client.close();
    }
}
run();
