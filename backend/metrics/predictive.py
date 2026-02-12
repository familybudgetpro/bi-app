import pandas as pd
import numpy as np
from scipy import stats
from backend.core.utils import apply_filters

def predict_loss_ratio(sales_df: pd.DataFrame, claims_df: pd.DataFrame, filters: dict = None) -> dict:
    """Predict future Loss Ratio using linear regression."""
    if sales_df is None or claims_df is None:
        return {}

    filters = filters or {}
    # Apply filters but ignore date range to get full history for trend analysis if needed
    # For now, let's respect filters to predict based on selected segment
    sales = apply_filters(sales_df, filters)
    claims = apply_filters(claims_df, filters)

    if 'Year' not in sales.columns or 'Month' not in sales.columns:
        return {'error': 'Missing time columns'}

    # Aggregate monthly
    sales_monthly = sales.groupby(['Year', 'Month'])['Gross Premium'].sum().reset_index()
    claims_monthly = claims.groupby(['Year', 'Month'])['Total Auth Amount'].sum().reset_index()

    merged = pd.merge(sales_monthly, claims_monthly, on=['Year', 'Month'], how='inner')
    merged['loss_ratio'] = (merged['Total Auth Amount'] / merged['Gross Premium'] * 100).fillna(0)
    merged['period_idx'] = range(len(merged))

    if len(merged) < 3:
        return {'error': 'Not enough data points for prediction'}

    # Linear Regression
    try:
        slope, intercept, r_value, p_value, std_err = stats.linregress(merged['period_idx'], merged['loss_ratio'])
    except Exception:
        slope, intercept, r_value = 0, 0, 0

    if np.isnan(slope) or np.isnan(intercept):
        slope, intercept, r_value = 0, 0, 0

    # Forecast next 3 months
    last_idx = merged['period_idx'].max()
    forecast = []
    current_year = merged['Year'].max()
    current_month = merged['Month'].max()

    for i in range(1, 4):
        next_idx = last_idx + i
        predicted_lr = max(0, slope * next_idx + intercept) # Clamp at 0
        
        # Increment month logic
        current_month += 1
        if current_month > 12:
            current_month = 1
            current_year += 1
            
        forecast.append({
            'period': f"{current_year}-{str(current_month).zfill(2)}",
            'predictedLossRatio': round(predicted_lr, 2) if not np.isnan(predicted_lr) else 0,
            'trend': 'Increasing' if slope > 0 else 'Decreasing'
        })

    return {
        'historicalSlope': round(slope, 4),
        'forecast': forecast,
        'rSquared': round(r_value**2, 4) if not np.isnan(r_value) else 0
    }
