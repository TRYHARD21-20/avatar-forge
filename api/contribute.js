export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.status(403).json({error:'Research contributions are disabled on the public Vercel demo.'});
}
