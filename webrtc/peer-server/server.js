import { PeerServer } from "peer";

const port = Number(process.env.PEER_PORT || 9000);
const path = process.env.PEER_PATH || "/peerjs";
const key = process.env.PEER_KEY || "peerjs";
const allowDiscovery = (process.env.PEER_ALLOW_DISCOVERY || "true") === "true";

const server = PeerServer({
  port,
  path,
  key,
  allow_discovery: allowDiscovery,
});

server.on("connection", (client) => {
  console.log(`peer connected: ${client.getId()}`);
});

server.on("disconnect", (client) => {
  console.log(`peer disconnected: ${client.getId()}`);
});

console.log(`PeerJS server listening on :${port}${path}`);
