import ftp from 'basic-ftp';

async function explore() {
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

        console.log("--- Current Directory ---");
        console.log("PWD:", await client.pwd());
        const listCurrent = await client.list();
        for (const item of listCurrent) {
            console.log(`${item.type === 1 ? 'DIR ' : 'FILE'} ${item.name}`);
        }

        console.log("\n--- Trying to go UP ---");
        try {
            await client.cd("..");
            console.log("PWD after cd ..:", await client.pwd());
            const listParent = await client.list();
            for (const item of listParent) {
                console.log(`${item.type === 1 ? 'DIR ' : 'FILE'} ${item.name}`);
            }
        } catch (e) {
            console.log("Could not go up:", e.message);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.close();
    }
}
explore();
