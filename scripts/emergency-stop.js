import ftp from 'basic-ftp';

async function emergencyStop() {
    const client = new ftp.Client();
    try {
        await client.access({
            host: "uin.lny.mybluehost.me",
            port: 21,
            user: "ZTOWN@uin.lny.mybluehost.me",
            password: "1dellaMuckle-0rca",
            secure: false
        });
        console.log("🚨 EMERGENCY: Removing .htaccess to stop redirection...");
        await client.remove(".htaccess");
        console.log("✅ .htaccess removed. Redirection should stop.");
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        client.close();
    }
}
emergencyStop();
