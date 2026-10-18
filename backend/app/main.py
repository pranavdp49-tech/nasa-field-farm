from datetime import date
import os
from io import BytesIO
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from .models import ClimateQuery, RecommendationRequest, ReportRequest
from .climate import get_climate
from .rotation import recommend_rotations, CROPS

app = FastAPI(title="Field Shift API", version="1.0.0", description="NASA POWER climate data and explainable crop rotation screening")
cors_origins = [origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Field Shift API", "version": app.version}

@app.get("/api/crops")
def crops():
    return {"crops": [{"id": key, **value} for key, value in CROPS.items()]}

@app.get("/api/climate")
async def climate(latitude: float, longitude: float, start_date: date, end_date: date):
    try:
        query = ClimateQuery(latitude=latitude, longitude=longitude, start_date=start_date, end_date=end_date)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        return await get_climate({
            "latitude": query.latitude, "longitude": query.longitude,
            "start_date": query.start_date.isoformat(), "end_date": query.end_date.isoformat(),
        })
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

@app.post("/api/recommendations")
def recommendations(request: RecommendationRequest):
    return recommend_rotations(request.farm.model_dump(), request.climate)

@app.post("/api/report")
def report(request: ReportRequest):
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_LEFT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="PDF export dependency is missing. Install backend requirements and retry.") from exc
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=16*mm, bottomMargin=16*mm)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="FieldShiftTitle", parent=styles["Title"], textColor=colors.HexColor("#174c35"), alignment=TA_LEFT, spaceAfter=8))
    styles.add(ParagraphStyle(name="SmallGrey", parent=styles["BodyText"], textColor=colors.HexColor("#59665d"), fontSize=8, leading=11))
    story = [Paragraph("Field Shift", styles["FieldShiftTitle"]), Paragraph("Farm adaptation & crop rotation screening report", styles["Heading2"]), Spacer(1, 5*mm)]
    farm = request.farm
    farm_rows = [
        ["Farm", farm.farm_name, "Region", farm.region],
        ["Coordinates", f"{farm.latitude:.4f}, {farm.longitude:.4f}", "Area", f"{farm.area_hectares:g} ha"],
        ["Soil", farm.soil_texture, "pH", str(farm.soil_ph) if farm.soil_ph is not None else "Unknown"],
        ["Irrigation", farm.irrigation, "Priority", farm.priority.replace("_", " ")],
    ]
    table = Table(farm_rows, colWidths=[25*mm, 52*mm, 25*mm, 52*mm])
    table.setStyle(TableStyle([("BACKGROUND", (0,0), (0,-1), colors.HexColor("#eef4ed")), ("BACKGROUND", (2,0), (2,-1), colors.HexColor("#eef4ed")), ("GRID", (0,0), (-1,-1), .35, colors.HexColor("#d7e0d7")), ("VALIGN", (0,0), (-1,-1), "TOP"), ("FONTSIZE", (0,0), (-1,-1), 8), ("PADDING", (0,0), (-1,-1), 6)]))
    story += [Paragraph("Farm profile", styles["Heading2"]), table, Spacer(1, 5*mm)]
    climate = request.climate or {}
    summary = climate.get("summary", {})
    story.append(Paragraph("Climate evidence", styles["Heading2"]))
    if summary:
        story.append(Paragraph(f"Source: NASA POWER Daily Point API. Period: {climate.get('period', {}).get('start', 'N/A')} to {climate.get('period', {}).get('end', 'N/A')}. Mean temperature: {summary.get('mean_temperature_c', 'N/A')} °C. Total precipitation over requested period: {summary.get('total_precipitation_mm', 'N/A')} mm. Mean annual precipitation: {summary.get('mean_annual_precipitation_mm', 'N/A')} mm.", styles["BodyText"]))
    else:
        story.append(Paragraph("No NASA climate summary was included in this report. Recommendations are not climate-informed.", styles["BodyText"]))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("Rotation options", styles["Heading2"]))
    for i, rotation in enumerate(request.recommendations[:6], start=1):
        name = rotation.get("name", "Rotation option")
        crops_text = " → ".join(str(x) for x in rotation.get("crops", []))
        story.append(Paragraph(f"{i}. {name} — relative fit score: {rotation.get('score', 'N/A')}/100", styles["Heading3"]))
        story.append(Paragraph(crops_text, styles["BodyText"]))
        story.append(Paragraph("Reasons: " + " ".join(rotation.get("reasons", [])), styles["BodyText"]))
        story.append(Paragraph("Risks: " + " ".join(rotation.get("risks", [])), styles["BodyText"]))
        story.append(Spacer(1, 3*mm))
    story += [Spacer(1, 5*mm), Paragraph("How to interpret this report", styles["Heading2"]), Paragraph("Rotation scores are transparent screening heuristics used to compare candidates. They are not yield, profit, or soil-health predictions. NASA POWER is gridded meteorological data and does not measure field-level soil fertility. Validate crop calendars, local varieties, soil-test results, water balance, pest history and market access with a local agronomist before changing farm practice.", styles["SmallGrey"])]
    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=field-shift-report.pdf"})
