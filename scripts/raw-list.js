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
        // This is a more robust way to get the LIST response
        console.log("Requesting LIST...");
        await client.send("LIST");
        
        // Wait for the data connection to finish printing to console (due to verbose)
        await new Promise(r => setTimeout(r, 5000));

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.close();
    }
}
rawExplore();
