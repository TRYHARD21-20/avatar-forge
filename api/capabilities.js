// Public Vercel demo: no research storage and no distributed room service configured.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  return res.status(200).json({rooms:false, researchContributions:false, mode:'vercel-solo-demo'});
}
