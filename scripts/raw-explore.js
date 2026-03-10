import ftp from 'basic-ftp';

async function rawExplore() {
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

        console.log("PWD:", await client.pwd());
        
        // Use raw list command to see what's actually there
        const response = await client.send("LIST -la");
        console.log("Raw LIST -la output:");
        console.log(response.message);

        // Also try to list the parent
        try {
            await client.cd("..");
            console.log("\nPWD after cd ..:", await client.pwd());
            const parentResponse = await client.send("LIST -la");
            console.log("Raw Parent LIST -la output:");
            console.log(parentResponse.message);
        } catch (e) {
            console.log("Could not go up:", e.message);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.close();
    }
}
rawExplore();
