import pandas as pd
from backend.core.utils import find_column, apply_filters

def get_claims_status(df: pd.DataFrame, filters: dict = None) -> list[dict]:
    """Claim status distribution."""
    if df is None:
        return []

    filters = filters or {}
    df_filtered = apply_filters(df, filters)

    if 'Claim Status' not in df_filtered.columns:
        return []

    grouped = df_filtered.groupby('Claim Status').agg(
        count=('Policy No', 'count') if 'Policy No' in df_filtered.columns else ('Claim Status', 'count'),
        totalAmount=('Total Auth Amount', 'sum') if 'Total Auth Amount' in df_filtered.columns else ('Claim Status', 'count'),
    ).reset_index()
    grouped.columns = ['status', 'count', 'totalAmount']

    colors = {'Approved': '#10b981', 'Rejected': '#ef4444', 'Reversed': '#f59e0b', 'Pending': '#3b82f6'}
    grouped['color'] = grouped['status'].map(lambda s: colors.get(s, '#64748b'))

    return grouped.to_dict('records')

def get_claims_parts(df: pd.DataFrame, filters: dict = None) -> list[dict]:
    """Part type failure analysis."""
    if df is None:
        return []

    filters = filters or {}
    df_filtered = apply_filters(df, filters)

    if 'Part Type' not in df_filtered.columns:
        return []

    grouped = df_filtered.groupby('Part Type').agg(
        count=('Policy No', 'count') if 'Policy No' in df_filtered.columns else ('Part Type', 'count'),
        totalAmount=('Total Auth Amount', 'sum') if 'Total Auth Amount' in df_filtered.columns else ('Part Type', 'count'),
        avgCost=('Total Auth Amount', 'mean') if 'Total Auth Amount' in df_filtered.columns else ('Part Type', 'count'),
    ).reset_index()
    grouped.columns = ['partType', 'count', 'totalAmount', 'avgCost']
    grouped = grouped.sort_values('count', ascending=False)
    grouped = grouped.fillna(0) # Ensure no NaNs from avgCost

    return grouped.to_dict('records')

def get_claims_trends(df: pd.DataFrame, filters: dict = None) -> list[dict]:
    """Monthly claim trends."""
    if df is None:
        return []

    filters = filters or {}
    df_filtered = apply_filters(df, filters)

    if 'Year' not in df_filtered.columns or 'Month' not in df_filtered.columns:
        return []

    grouped = df_filtered.groupby(['Year', 'Month']).agg(
        count=('Policy No', 'count') if 'Policy No' in df_filtered.columns else ('Year', 'count'),
        totalAmount=('Total Auth Amount', 'sum') if 'Total Auth Amount' in df_filtered.columns else ('Year', 'count'),
        laborCost=('Labor', 'sum') if 'Labor' in df_filtered.columns else ('Year', 'count'),
        partsCost=('Parts', 'sum') if 'Parts' in df_filtered.columns else ('Year', 'count'),
    ).reset_index()
    grouped = grouped.sort_values(['Year', 'Month'])
    grouped['period'] = grouped['Year'].astype(str) + '-' + grouped['Month'].astype(str).str.zfill(2)
    grouped = grouped.fillna(0)

    return grouped.to_dict('records')

def get_claims_recent(df: pd.DataFrame, filters: dict = None, limit: int = 50) -> list[dict]:
    """Recent claims table data."""
    if df is None:
        return []

    filters = filters or {}
    df_filtered = apply_filters(df, filters)

    date_col = find_column(df_filtered, ['Failure Date', 'Authorized Date'])
    if date_col:
        df_filtered = df_filtered.sort_values(date_col, ascending=False)

    result = df_filtered.head(limit).copy()
    # Convert dates to strings
    for col in result.columns:
        if result[col].dtype == 'datetime64[ns]':
            result[col] = result[col].dt.strftime('%Y-%m-%d')
    result = result.drop(columns=['_row_id'], errors='ignore')

    return result.to_dict('records')
