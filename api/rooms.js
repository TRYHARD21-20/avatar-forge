// Do not pretend ephemeral in-memory multiplayer rooms work across Functions.
export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.status(503).json({error:'Live Duo and Squad require shared room storage and WebSocket orchestration. Use the local backend until that integration is deployed.'});
}
