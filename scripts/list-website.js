import ftp from 'basic-ftp';

async function listWebsite() {
    const client = new ftp.Client();
    try {
        await client.access({
            host: "uin.lny.mybluehost.me",
            port: 21,
            user: "ZTOWN@uin.lny.mybluehost.me",
            password: "1dellaMuckle-0rca",
            secure: false
        });
        
        console.log("Listing /website_f4ed6cb8 content:");
        const list = await client.list("/website_f4ed6cb8");
        list.forEach(item => {
            console.log(`[${item.type}] ${item.name} (${item.size} bytes)`);
        });

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.close();
    }
}
listWebsite();
