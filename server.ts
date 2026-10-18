import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer as createViteServer } from 'vite'
import { CROPS, recommendRotations } from './src/lib/rotation'
import { getClimate } from './src/lib/climate'
import { generateReportPdf } from './src/lib/report'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function startServer() {
  const app = express()
  const port = Number(process.env.PORT) || 3000
  const isProd = process.env.NODE_ENV === 'production'

  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  // API Endpoints
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Field Shift API', version: '1.0.0' })
  })

  app.get('/api/crops', (_req, res) => {
    res.json({ crops: Object.entries(CROPS).map(([id, val]) => ({ id, ...val })) })
  })

  app.get('/api/climate', async (req, res) => {
    const lat = Number(req.query.latitude)
    const lon = Number(req.query.longitude)
    const startDate = String(req.query.start_date || '')
    const endDate = String(req.query.end_date || '')

    if (isNaN(lat) || lat < -90 || lat > 90) {
      res.status(422).json({ detail: 'Invalid latitude. Must be between -90 and 90.' })
      return
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      res.status(422).json({ detail: 'Invalid longitude. Must be between -180 and 180.' })
      return
    }
    if (!startDate || !endDate) {
      res.status(422).json({ detail: 'start_date and end_date are required in YYYY-MM-DD format.' })
      return
    }

    const startYear = parseInt(startDate.slice(0, 4), 10)
    if (startYear < 1981) {
      res.status(422).json({ detail: 'NASA POWER daily data starts in 1981; choose a later start date' })
      return
    }

    try {
      const data = await getClimate({
        latitude: lat,
        longitude: lon,
        start_date: startDate,
        end_date: endDate,
      })
      res.json(data)
    } catch (err: any) {
      res.status(502).json({ detail: err.message || 'NASA POWER request failed.' })
    }
  })

  app.post('/api/recommendations', (req, res) => {
    try {
      const { farm, climate } = req.body || {}
      if (!farm) {
        res.status(422).json({ detail: 'farm object is required' })
        return
      }
      const result = recommendRotations(farm, climate)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ detail: err.message || 'Recommendation calculation failed.' })
    }
  })

  app.post('/api/report', (req, res) => {
    try {
      const { farm, climate, recommendations } = req.body || {}
      if (!farm) {
        res.status(422).json({ detail: 'farm object is required' })
        return
      }
      const pdfBytes = generateReportPdf(farm, climate, recommendations || [])
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="field-shift-report.pdf"')
      res.send(Buffer.from(pdfBytes))
    } catch (err: any) {
      res.status(500).json({ detail: err.message || 'Failed to generate PDF report.' })
    }
  })

  // Static files or Vite dev middleware
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.resolve(__dirname, 'dist')
    app.use(express.static(distPath))
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'))
    })
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Field Shift server listening on http://0.0.0.0:${port}`)
  })
}

startServer().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
