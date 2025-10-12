import { Daytona } from "@daytonaio/sdk";

const daytona = new Daytona();
const sandbox = await daytona.get("875a84f0-4d48-43ea-bcb5-8c19dc3d53ad");

// Create SSH access token
const sshAccess = await sandbox.createSshAccess(60);
console.log(`SSH Token: ${sshAccess.token}`);
