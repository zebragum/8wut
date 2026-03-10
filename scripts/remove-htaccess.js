import ftp from 'basic-ftp';

async function removeHtaccess() {
    const client = new ftp.Client();
    try {
        await client.access({
            host: "uin.lny.mybluehost.me",
            port: 21,
            user: "ZTOWN@uin.lny.mybluehost.me",
            password: "1dellaMuckle-0rca",
            secure: false
        });
        console.log("Checking for .htaccess...");
        const list = await client.list("/");
        const exists = list.find(f => f.name === ".htaccess");
        if (exists) {
            console.log("Removing .htaccess...");
            if (exists.type === 1) await client.removeDir(".htaccess");
            else await client.remove(".htaccess");
            console.log("Removed!");
        } else {
            console.log(".htaccess not found.");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.close();
    }
}

removeHtaccess();
