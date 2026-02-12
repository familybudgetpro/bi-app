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

# Import core modules
from backend.core.data_manager import DataManager
from backend.ai.gemini import GeminiService
from backend.metrics import sales, claims, kpis, budget, predictive

app = FastAPI(title="Clarity BI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
data_manager = DataManager()
gemini = GeminiService()


# ─── Auto-load data on startup ──────────────────────────────

@app.on_event("startup")
async def startup():
    """Auto-load the Excel file if it exists."""
    # Check project root and local backend dir
    root_path = os.path.join(os.path.dirname(__file__), '..', 'Sales&ClaimsData.xls')
    local_path = os.path.join(os.path.dirname(__file__), 'Sales&ClaimsData.xls')
    
    excel_path = root_path if os.path.exists(root_path) else local_path
    
    if os.path.exists(excel_path):
        try:
            data_manager.load_excel(file_path=excel_path)
            print(f"Auto-loaded {excel_path}")
            print(f"   Sales: {len(data_manager.sales_df)} rows")
            print(f"   Claims: {len(data_manager.claims_df)} rows")
        except Exception as e:
            print(f"Failed to auto-load: {e}")


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
        data_manager.load_excel(file_bytes=contents)
        return {
            "success": True,
            "fileName": file.filename,
            "salesRows": len(data_manager.sales_df),
            "claimsRows": len(data_manager.claims_df),
            "filterOptions": data_manager.get_filter_options(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Health & Status ───────────────────────────────────────

@app.get("/api/status")
async def get_status():
    """Check if data is loaded and AI is available."""
    return {
        "dataLoaded": data_manager.sales_df is not None,
        "salesRows": len(data_manager.sales_df) if data_manager.sales_df is not None else 0,
        "claimsRows": len(data_manager.claims_df) if data_manager.claims_df is not None else 0,
        "aiAvailable": gemini.is_available,
        "pendingChanges": len(data_manager.change_log),
    }


# ─── Filters & Summary ─────────────────────────────────────

def _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status):
    filters = {
        'dealer': dealer, 'product': product, 'year': year, 'month': month,
        'make': make, 'date_from': date_from, 'date_to': date_to,
        'search': search, 'claim_status': claim_status,
    }
    # Filter out None and 'All'
    return {k: v for k, v in filters.items() if v is not None and v != 'All' and v != ''}

@app.get("/api/summary")
async def get_summary(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return kpis.get_summary(data_manager.sales_df, data_manager.claims_df, data_manager.merged_df, filters)

@app.get("/api/filters")
async def get_filter_options():
    """Get available filter values."""
    return data_manager.get_filter_options()


# ─── Sales Metrics ─────────────────────────────────────────

@app.get("/api/sales/monthly")
async def sales_monthly(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return sales.get_sales_monthly(data_manager.sales_df, filters)

@app.get("/api/sales/dealers")
async def sales_dealers(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return sales.get_sales_dealers(data_manager.sales_df, data_manager.merged_df, filters)

@app.get("/api/sales/products")
async def sales_products(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return sales.get_sales_products(data_manager.sales_df, filters)

@app.get("/api/sales/vehicles")
async def sales_vehicles(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return sales.get_sales_vehicles(data_manager.sales_df, filters)


# ─── Claims Metrics ────────────────────────────────────────

@app.get("/api/claims/status")
async def claims_status(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return claims.get_claims_status(data_manager.claims_df, filters)

@app.get("/api/claims/parts")
async def claims_parts(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return claims.get_claims_parts(data_manager.claims_df, filters)

@app.get("/api/claims/trends")
async def claims_trends(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return claims.get_claims_trends(data_manager.claims_df, filters)

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
    return claims.get_claims_recent(data_manager.claims_df, filters, limit)


# ─── New Features ──────────────────────────────────────────

@app.get("/api/budget")
async def get_budget(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return budget.get_budget_vs_achieved(data_manager.sales_df, filters)

@app.get("/api/predict")
async def get_prediction(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return predictive.predict_loss_ratio(data_manager.sales_df, data_manager.claims_df, filters)


# ─── Data Validation ───────────────────────────────────────

@app.get("/api/validate")
async def validate_data():
    """Validate data structure and quality."""
    issues = []
    if data_manager.sales_df is None:
        return {"status": "error", "issues": [{"type": "missing_data", "message": "Sales data not loaded"}]}
    
    # Simple checks
    if len(data_manager.sales_df) < 100:
        issues.append({"type": "data_volume", "message": "Low sales data volume"})
        
    return {
        "status": "valid" if not issues else "warning",
        "issues": issues
    }

# ─── Advanced Analytics ────────────────────────────────────

@app.get("/api/correlations")
async def correlations(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    return kpis.get_correlations(data_manager.merged_df, filters)

@app.get("/api/insights")
async def get_insights(
    dealer: str = Query(None), product: str = Query(None),
    year: str = Query(None), month: str = Query(None),
    make: str = Query(None), date_from: str = Query(None),
    date_to: str = Query(None), search: str = Query(None),
    claim_status: str = Query(None),
):
    filters = _parse_filters(dealer, product, year, month, make, date_from, date_to, search, claim_status)
    
    # 1. Loss Ratio Analysis
    summary = kpis.get_summary(data_manager.sales_df, data_manager.claims_df, data_manager.merged_df, filters)
    insights_list = []
    
    if summary:
        loss_ratio = summary.get('lossRatio', 0)
        if loss_ratio > 80:
            insights_list.append({
                "type": "warning",
                "title": "High Loss Ratio Alert",
                "message": f"current Loss Ratio is {loss_ratio}%, which exceeds the 80% threshold."
            })
        elif loss_ratio < 40:
             insights_list.append({
                "type": "success",
                "title": "Healthy Performance",
                "message": f"Loss Ratio is excellent at {loss_ratio}%."
            })

    # 2. Predictive Trend
    prediction = predictive.predict_loss_ratio(data_manager.sales_df, data_manager.claims_df, filters)
    if 'historicalSlope' in prediction:
        trend = "increasing" if prediction['historicalSlope'] > 0 else "decreasing"
        insights_list.append({
            "type": "info" if trend == "decreasing" else "warning",
            "title": f"Loss Ratio Trend",
            "message": f"Loss Ratio is trending {trend} based on recent data."
        })

    return insights_list


# ─── Data Management ───────────────────────────────────────

@app.get("/api/data/{table}")
async def get_data_table(
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
    return data_manager.get_raw_data(table, page, limit, filters, sort_by, sort_dir) 

@app.put("/api/data/update")
async def update_cell(update: CellUpdate):
    result = data_manager.update_cell(update.table, update.row_id, update.column, update.new_value)
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['error'])
    return result

@app.put("/api/data/bulk-update")
async def bulk_update(payload: BulkUpdate):
    result = data_manager.bulk_update(payload.table, payload.updates)
    if not result['success']:
        raise HTTPException(status_code=400, detail="Some updates failed")
    return result

@app.post("/api/data/reset")
async def reset_data():
    return data_manager.reset_data()

@app.get("/api/data/changes")
async def get_changes():
    return data_manager.change_log

@app.get("/api/export/{table}")
async def export_data(table: str):
    data = data_manager.export_data(table)
    if not data:
        raise HTTPException(status_code=404, detail="No data to export")

    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={table}_data.xlsx"}
    )


# ─── Chat ──────────────────────────────────────────────────

@app.post("/api/chat")
async def chat(payload: ChatMessage):
    data_context = data_manager.get_data_summary_for_ai(payload.filters)
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
    data_context = data_manager.get_data_summary_for_ai()
    return {"suggestions": gemini.get_suggestions(data_context)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
