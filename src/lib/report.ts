import { jsPDF } from 'jspdf'
import type { FarmProfile, ClimateData, Rotation } from '../types'

export function generateReportPdf(
  farm: FarmProfile,
  climate: ClimateData | null | undefined,
  recommendations: Rotation[],
): Uint8Array {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
  })

  const marginX = 18
  let cursorY = 20
  const pageWidth = 210
  const contentWidth = pageWidth - marginX * 2

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(23, 76, 53) // #174c35
  doc.text('Field Shift', marginX, cursorY)
  cursorY += 8

  // Subtitle
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(40, 55, 45)
  doc.text('Farm adaptation & crop rotation screening report', marginX, cursorY)
  cursorY += 10

  // Farm Profile Section
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(23, 76, 53)
  doc.text('Farm profile', marginX, cursorY)
  cursorY += 6

  // Table header background & box
  doc.setDrawColor(215, 224, 215)
  doc.setLineWidth(0.3)

  const farmRows = [
    ['Farm', farm.farm_name, 'Region', farm.region],
    ['Coordinates', `${farm.latitude.toFixed(4)}, ${farm.longitude.toFixed(4)}`, 'Area', `${farm.area_hectares} ha`],
    ['Soil', farm.soil_texture, 'pH', farm.soil_ph !== null ? String(farm.soil_ph) : 'Unknown'],
    ['Irrigation', farm.irrigation, 'Priority', farm.priority.replaceAll('_', ' ')],
  ]

  const colWidths = [28, 57, 28, 61]
  const rowHeight = 7

  doc.setFontSize(9)
  farmRows.forEach((row) => {
    let cellX = marginX
    row.forEach((text, cIdx) => {
      const w = colWidths[cIdx]
      if (cIdx % 2 === 0) {
        doc.setFillColor(238, 244, 237) // #eef4ed
        doc.rect(cellX, cursorY, w, rowHeight, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(35, 55, 40)
      } else {
        doc.setFillColor(255, 255, 255)
        doc.rect(cellX, cursorY, w, rowHeight, 'FD')
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(50, 60, 50)
      }
      doc.text(String(text), cellX + 3, cursorY + 4.8)
      cellX += w
    })
    cursorY += rowHeight
  })

  cursorY += 7

  // Climate evidence
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(23, 76, 53)
  doc.text('Climate evidence', marginX, cursorY)
  cursorY += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(50, 65, 55)

  const summary = climate?.summary
  let climateText = ''
  if (summary) {
    climateText = `Source: NASA POWER Daily Point API. Period: ${climate.period.start} to ${climate.period.end}. Mean temperature: ${summary.mean_temperature_c ?? 'N/A'} °C. Total precipitation over requested period: ${summary.total_precipitation_mm ?? 'N/A'} mm. Mean annual precipitation: ${summary.mean_annual_precipitation_mm ?? 'N/A'} mm.`
  } else {
    climateText = 'No NASA climate summary was included in this report. Recommendations are not climate-informed.'
  }

  const splitClimate = doc.splitTextToSize(climateText, contentWidth)
  doc.text(splitClimate, marginX, cursorY)
  cursorY += splitClimate.length * 4.5 + 6

  // Rotation options
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(23, 76, 53)
  doc.text('Rotation options', marginX, cursorY)
  cursorY += 5

  const listToShow = recommendations.slice(0, 6)
  listToShow.forEach((rot, i) => {
    if (cursorY > 255) {
      doc.addPage()
      cursorY = 20
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(25, 50, 35)
    doc.text(`${i + 1}. ${rot.name} — relative fit score: ${rot.score}/100`, marginX, cursorY)
    cursorY += 4.5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(70, 85, 75)
    const sequenceStr = rot.crops.join('  →  ')
    doc.text(sequenceStr, marginX, cursorY)
    cursorY += 4.5

    if (rot.reasons.length > 0) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(50, 65, 55)
      const reasonsText = 'Reasons: ' + rot.reasons.join(' ')
      const splitReasons = doc.splitTextToSize(reasonsText, contentWidth)
      doc.text(splitReasons, marginX, cursorY)
      cursorY += splitReasons.length * 4 + 1
    }

    if (rot.risks.length > 0) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(140, 75, 45)
      const risksText = 'Risks: ' + rot.risks.join(' ')
      const splitRisks = doc.splitTextToSize(risksText, contentWidth)
      doc.text(splitRisks, marginX, cursorY)
      cursorY += splitRisks.length * 4 + 1
    }

    cursorY += 3
  })

  // How to interpret this report
  if (cursorY > 240) {
    doc.addPage()
    cursorY = 20
  } else {
    cursorY += 4
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(23, 76, 53)
  doc.text('How to interpret this report', marginX, cursorY)
  cursorY += 4.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90, 105, 95)
  const interpText =
    'Rotation scores are transparent screening heuristics used to compare candidates. They are not yield, profit, or soil-health predictions. NASA POWER is gridded meteorological data and does not measure field-level soil fertility. Validate crop calendars, local varieties, soil-test results, water balance, pest history and market access with a local agronomist before changing farm practice.'
  const splitInterp = doc.splitTextToSize(interpText, contentWidth)
  doc.text(splitInterp, marginX, cursorY)

  return doc.output('arraybuffer') as unknown as Uint8Array
}
