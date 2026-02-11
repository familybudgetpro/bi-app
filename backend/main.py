"""
Clarity BI — FastAPI Backend
Real-time data processing, analytics, inline editing, and Gemini AI for Sales & Claims data.
"""

from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Any
import os
import io
from dotenv import load_dotenv

# Load env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from data_processor import DataProcessor
from gemini_service import GeminiService

app = FastAPI(title="Clarity BI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
processor = DataProcessor()
gemini = GeminiService()


# ─── Auto-load data on startup ──────────────────────────────

@app.on_event("startup")
async def startup():
    """Auto-load the Excel file if it exists in project root."""
    excel_path = os.path.join(os.path.dirname(__file__), '..', 'Sales&ClaimsData.xls')
    if os.path.exists(excel_path):
        try:
            processor.load_excel(file_path=excel_path)
            print(f"✅ Auto-loaded {excel_path}")
            print(f"   Sales: {len(processor.sales_df)} rows")
            print(f"   Claims: {len(processor.claims_df)} rows")
        except Exception as e:
            print(f"⚠️ Failed to auto-load: {e}")


# ─── Models ────────────────────────────────────────────────

class CellUpdate(BaseModel):
    table: str
    row_id: int
    column: str
    new_value: Any

class BulkUpdate(BaseModel):
    table: str
    updates: list[dict]

class ChatMessage(BaseModel):
    message: str
    history: Optional[list[dict]] = None
    filters: Optional[dict] = None


# ─── Upload ────────────────────────────────────────────────

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload an Excel file and process both sheets."""
    try:
        contents = await file.read()
        processor.load_excel(file_bytes=contents)
        return {
            "success": True,
            "fileName": file.filename,
            "salesRows": len(processor.sales_df),
            "claimsRows": len(processor.claims_df),
            "filterOptions": processor.get_filter_options(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Health & Status ───────────────────────────────────────

@app.get("/api/status")
async def get_status():
    """Check if data is loaded and AI is available."""
    return {
        "dataLoaded": processor.sales_df is not None,
        "salesRows": len(processor.sales_df) if processor.sales_df is not None else 0,
        "claimsRows": len(processor.claims_df) if processor.claims_df is not None else 0,
        "aiAvailable": gemini.is_available,
        "pendingChanges": len(processor.change_log),
    }


# ─── Summary / KPIs ───────────────────────────────────────

@app.get("/api/summary")
async def get_summary(
    dealer: str = Query(None),
    product: str = Query(None),
    year: str = Query(None),
    month: str = Query(None),
    make: str = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = {k: v for k, v in {
        'dealer': dealer, 'product': product, 'year': year, 'month': month,
        'make': make, 'date_from': date_from, 'date_to': date_to,
        'search': search, 'claim_status': claim_status,
    }.items() if v is not None}
    return processor.get_summary(filters)


@app.get("/api/filters")
async def get_filter_options():
    """Get available filter values."""
    return processor.get_filter_options()


# ─── Sales ─────────────────────────────────────────────────

def _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status):
    return {k: v for k, v in {
        'dealer': dealer, 'product': product, 'year': year, 'month': month,
        'make': make, 'date_from': date_from, 'date_to': date_to,
        'search': search, 'claim_status': claim_status,
    }.items() if v is not None}


@app.get("/api/sales/monthly")
async def sales_monthly(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return processor.get_sales_monthly(filters)


@app.get("/api/sales/dealers")
async def sales_dealers(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return processor.get_sales_dealers(filters)


@app.get("/api/sales/products")
async def sales_products(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return processor.get_sales_products(filters)


@app.get("/api/sales/vehicles")
async def sales_vehicles(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return processor.get_sales_vehicles(filters)


# ─── Claims ───────────────────────────────────────────────

@app.get("/api/claims/status")
async def claims_status(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return processor.get_claims_status(filters)


@app.get("/api/claims/parts")
async def claims_parts(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return processor.get_claims_parts(filters)


@app.get("/api/claims/trends")
async def claims_trends(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return processor.get_claims_trends(filters)


@app.get("/api/claims/recent")
async def claims_recent(
    limit: int = Query(50),
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return processor.get_claims_recent(filters, limit)


@app.get("/api/insights")
async def get_insights(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return processor.get_insights(filters)


@app.get("/api/validate")
async def validate_data():
    return processor.validate_data()


# ─── Correlations ──────────────────────────────────────────

@app.get("/api/correlations")
async def correlations(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return processor.get_correlations(filters)


# ─── Raw Data (Paginated) ─────────────────────────────────

@app.get("/api/data/{table}")
async def get_data(
    table: str,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=10, le=500),
    sort_by: str = Query(None),
    sort_dir: str = Query('asc'),
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return processor.get_raw_data(table, page, limit, filters, sort_by, sort_dir)


# ─── Inline Editing ────────────────────────────────────────

@app.put("/api/data/update")
async def update_cell(update: CellUpdate):
    result = processor.update_cell(update.table, update.row_id, update.column, update.new_value)
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['error'])
    return result


@app.put("/api/data/bulk-update")
async def bulk_update(payload: BulkUpdate):
    result = processor.bulk_update(payload.table, payload.updates)
    if not result['success']:
        raise HTTPException(status_code=400, detail="Some updates failed")
    return result


@app.post("/api/data/reset")
async def reset_data():
    return processor.reset_data()


@app.get("/api/data/changes")
async def get_changes():
    return processor.get_change_log()


# ─── Export ────────────────────────────────────────────────

@app.get("/api/export/{table}")
async def export_data(table: str):
    data = processor.export_data(table)
    if not data:
        raise HTTPException(status_code=404, detail="No data to export")

    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={table}_data.xlsx"}
    )


# ─── AI Chat ──────────────────────────────────────────────

@app.post("/api/chat")
async def chat(payload: ChatMessage):
    data_context = processor.get_data_summary_for_ai(payload.filters)
    result = gemini.chat(payload.message, data_context, payload.history)
    suggestions = gemini.get_suggestions(data_context) if gemini.is_available else []
    return {
        "response": result.get('text', str(result)) if isinstance(result, dict) else str(result),
        "actions": result.get('actions') if isinstance(result, dict) else None,
        "suggestions": suggestions,
        "aiAvailable": gemini.is_available,
    }


@app.get("/api/chat/suggestions")
async def chat_suggestions():
    if not gemini.is_available:
        return {"suggestions": []}
    data_context = processor.get_data_summary_for_ai()
    return {"suggestions": gemini.get_suggestions(data_context)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
