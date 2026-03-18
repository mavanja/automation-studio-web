export default async function handler(req, res) {
  const { id } = req.query

  const response = await fetch(
    `https://rzwfhokwmuuypvrrhfjq.supabase.co/functions/v1/post-preview?id=${id}`,
    {
      headers: {
        'user-agent': req.headers['user-agent'] || '',
        'x-forwarded-for': req.headers['x-forwarded-for'] || '',
      },
    }
  )

  const html = await response.text()
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).send(html)
}
