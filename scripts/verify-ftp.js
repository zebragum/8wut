import ftp from 'basic-ftp';

async function listRoot() {
    const client = new ftp.Client();
    try {
        await client.access({
            host: "uin.lny.mybluehost.me",
            port: 21,
            user: "ZTOWN@uin.lny.mybluehost.me",
            password: "1dellaMuckle-0rca",
            secure: false
        });
        const list = await client.list("/");
        console.log("Remote Files:");
        for (const item of list) {
            const type = item.type === 1 ? "DIR" : "FILE";
            console.log(`${type} - ${item.name} (${item.size} bytes)`);
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.close();
    }
}

listRoot();
