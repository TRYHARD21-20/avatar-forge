export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.status(409).json({error:'This hosted demo does not accept research contributions, so no remote receipts are stored here.'});
}
