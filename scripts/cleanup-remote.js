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
        console.log("🗑 Removing large non-essential image to free space...");
        await client.remove("monotile.jpg");
        console.log("✅ Removed monotile.jpg (3.5MB)");
    } catch (e) {
        console.error("Cleanup failed:", e);
    } finally {
        client.close();
    }
}
run();
