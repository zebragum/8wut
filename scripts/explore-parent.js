import ftp from 'basic-ftp';

async function exploreParent() {
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

        console.log("Current PWD:", await client.pwd());
        
        try {
            await client.cd("..");
            console.log("Moved to Parent PWD:", await client.pwd());
            const list = await client.list(".");
            console.log("Parent Contents:");
            list.forEach(item => {
                console.log(`[${item.type}] ${item.name}`);
            });
        } catch (e) {
            console.log("Could not move to parent:", e.message);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.close();
    }
}
exploreParent();
