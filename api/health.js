// Minimal Vercel health endpoint for the public demo. No personal data.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  return res.status(200).json({ok:true, product:'Avatar Forge', version:'1.0.0', platform:'vercel', mode:'solo-demo'});
}
