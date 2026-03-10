import ftp from 'basic-ftp';

async function listRoot() {
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
        console.log("Current directory:", await client.pwd());
        console.log("Listing contents (including hidden):");
        const list = await client.list();
        console.log(list.map(f => `${f.type === 1 ? 'd' : '-'} ${f.name}`));
    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.close();
    }
}

listRoot();
