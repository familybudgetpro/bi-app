import pandas as pd
import numpy as np
from backend.core.utils import find_column, apply_filters

def get_sales_monthly(df: pd.DataFrame, filters: dict = None) -> list[dict]:
    """Monthly sales trends."""
    if df is None:
        return []

    filters = filters or {}
    df_filtered = apply_filters(df, filters)

    if 'Year' not in df_filtered.columns or 'Month' not in df_filtered.columns:
        return []

    grouped = df_filtered.groupby(['Year', 'Month']).agg(
        premium=('Gross Premium', 'sum'),
        riskPremium=('Risk Premium', 'sum'),
        policies=('Policy No', 'count') if 'Policy No' in df_filtered.columns else ('Year', 'count'),
    ).reset_index()

    grouped = grouped.sort_values(['Year', 'Month'])
    grouped['period'] = grouped['Year'].astype(str) + '-' + grouped['Month'].astype(str).str.zfill(2)
    
    grouped = grouped.fillna(0) # Ensure no NaNs

    return grouped.to_dict('records')

def get_sales_dealers(df: pd.DataFrame, merged_df: pd.DataFrame = None, filters: dict = None) -> list[dict]:
    """Dealer performance breakdown."""
    if df is None:
        return []

    filters = filters or {}
    df_filtered = apply_filters(df, filters)
    dealer_col = find_column(df_filtered, ['Dealer'])
    if not dealer_col:
        return []

    grouped = df_filtered.groupby(dealer_col).agg(
        premium=('Gross Premium', 'sum'),
        riskPremium=('Risk Premium', 'sum'),
        policies=('Policy No', 'count') if 'Policy No' in df_filtered.columns else (dealer_col, 'count'),
    ).reset_index()
    grouped.columns = ['dealer', 'premium', 'riskPremium', 'policies']

    # Add claim info from merged
    if merged_df is not None:
        merged_f = apply_filters(merged_df, filters)
        dealer_claims = merged_f.groupby(dealer_col).agg(
            claimsCount=('has_claim', 'sum'),
            totalClaimAmount=('total_claim_amount', 'sum'),
        ).reset_index()
        dealer_claims.columns = ['dealer', 'claimsCount', 'totalClaimAmount']
        grouped = grouped.merge(dealer_claims, on='dealer', how='left')
        grouped['claimsCount'] = grouped['claimsCount'].fillna(0).astype(int)
        grouped['totalClaimAmount'] = grouped['totalClaimAmount'].fillna(0)
        grouped['lossRatio'] = np.where(grouped['premium'] > 0,
                                        (grouped['totalClaimAmount'] / grouped['premium'] * 100).round(1), 0)
        grouped['claimRate'] = np.where(grouped['policies'] > 0,
                                        (grouped['claimsCount'] / grouped['policies'] * 100).round(1), 0)

    grouped = grouped.fillna(0)
    return grouped.to_dict('records')

def get_sales_products(df: pd.DataFrame, filters: dict = None) -> list[dict]:
    """Product mix breakdown."""
    if df is None:
        return []

    filters = filters or {}
    df_filtered = apply_filters(df, filters)
    prod_col = find_column(df_filtered, ['Product', 'Coverage'])
    if not prod_col:
        return []

    grouped = df_filtered.groupby(prod_col).agg(
        premium=('Gross Premium', 'sum'),
        riskPremium=('Risk Premium', 'sum'),
        count=('Policy No', 'count') if 'Policy No' in df_filtered.columns else (prod_col, 'count'),
    ).reset_index()
    grouped.columns = ['product', 'premium', 'riskPremium', 'count']

    grouped = grouped.fillna(0)
    return grouped.to_dict('records')

def get_sales_vehicles(df: pd.DataFrame, filters: dict = None) -> list[dict]:
    """Vehicle make breakdown."""
    if df is None:
        return []

    filters = filters or {}
    df_filtered = apply_filters(df, filters)

    if 'Make' not in df_filtered.columns:
        return []

    grouped = df_filtered.groupby('Make').agg(
        premium=('Gross Premium', 'sum'),
        count=('Policy No', 'count') if 'Policy No' in df_filtered.columns else ('Make', 'count'),
    ).reset_index()
    grouped.columns = ['make', 'premium', 'count']
    grouped = grouped.sort_values('count', ascending=False).head(20)

    grouped = grouped.fillna(0)
    return grouped.to_dict('records')
