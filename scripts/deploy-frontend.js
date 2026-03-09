import FtpDeploy from 'ftp-deploy';
const ftpDeploy = new FtpDeploy();

const config = {
    user: "ZTOWN@uin.lny.mybluehost.me",
    // Password is hardcoded here as per user request for simplicity, 
    // but in a real prod env we'd use process.env.FTP_PASSWORD
    password: "1dellaMuckle-0rca", 
    host: "uin.lny.mybluehost.me",
    port: 21,
    localRoot: "./dist",
    remoteRoot: "/home2/uinlnymy/public_html",
    include: ["*", "**/*"],      // this would upload everything except dot files
    // exclude: ["dist/**/*.map", "node_modules/**", "node_modules/**/.*", ".git/**"],
    deleteRemote: true,           // delete ALL existing files at remote site before uploading
    forcePasv: true,              // Passive mode is usually required for Bluehost
    sftp: false,                  // Bluehost FTP usually uses plain FTP or FTPS
};

console.log("🚀 Starting deployment to Bluehost...");

ftpDeploy
    .deploy(config)
    .then((res) => console.log("✅ Finished deployment:", res))
    .catch((err) => console.error("❌ Deployment error:", err));
