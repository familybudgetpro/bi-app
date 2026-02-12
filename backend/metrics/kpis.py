import pandas as pd
from backend.core.utils import find_column, apply_filters

def get_summary(sales_df: pd.DataFrame, claims_df: pd.DataFrame, merged_df: pd.DataFrame, filters: dict = None) -> dict:
    """Get overall KPI summary."""
    if sales_df is None:
        return {}

    filters = filters or {}
    sales = apply_filters(sales_df, filters)
    claims = apply_filters(claims_df, filters)

    total_premium = float(sales['Gross Premium'].sum()) if 'Gross Premium' in sales.columns else 0
    total_risk_premium = float(sales['Risk Premium'].sum()) if 'Risk Premium' in sales.columns else 0
    total_claims_amount = float(claims['Total Auth Amount'].sum()) if 'Total Auth Amount' in claims.columns else 0
    total_policies = len(sales)
    total_claims = len(claims)

    policies_with_claims = 0
    if merged_df is not None:
        merged_filtered = apply_filters(merged_df, filters)
        policies_with_claims = int(merged_filtered['has_claim'].sum())

    claim_rate = (policies_with_claims / total_policies * 100) if total_policies > 0 else 0
    loss_ratio = (total_claims_amount / total_premium * 100) if total_premium > 0 else 0
    avg_claim_cost = (total_claims_amount / total_claims) if total_claims > 0 else 0
    avg_premium = (total_premium / total_policies) if total_policies > 0 else 0

    return {
        'totalPremium': round(total_premium, 2),
        'totalRiskPremium': round(total_risk_premium, 2),
        'totalClaimsAmount': round(total_claims_amount, 2),
        'totalPolicies': total_policies,
        'totalClaims': total_claims,
        'claimRate': round(claim_rate, 1),
        'lossRatio': round(loss_ratio, 1),
        'avgClaimCost': round(avg_claim_cost, 2),
        'avgPremium': round(avg_premium, 2),
        'policiesWithClaims': policies_with_claims,
        'uniqueMakes': int(sales['Make'].nunique()) if 'Make' in sales.columns else 0,
        'uniqueDealers': int(sales['Dealer'].nunique()) if 'Dealer' in sales.columns else 0,
    }

def get_correlations(merged_df: pd.DataFrame, filters: dict = None) -> dict:
    """Sales-Claims correlations."""
    if merged_df is None:
        return {}

    filters = filters or {}
    df = apply_filters(merged_df, filters)
    result = {}

    import pandas as pd
    import numpy as np
    from backend.core.utils import find_column

    # Helper to clean df
    def clean_df(d):
        return d.fillna(0).replace([np.inf, -np.inf], 0)

    # Claim rate by dealer
    dealer_col = find_column(df, ['Dealer'])
    if dealer_col:
        by_dealer = df.groupby(dealer_col).agg(
            policies=(dealer_col, 'count'),
            withClaims=('has_claim', 'sum'),
            totalPremium=('Gross Premium', 'sum') if 'Gross Premium' in df.columns else (dealer_col, 'count'),
            totalClaimAmount=('total_claim_amount', 'sum'),
        ).reset_index()
        by_dealer.columns = ['dealer', 'policies', 'withClaims', 'totalPremium', 'totalClaimAmount']
        by_dealer['claimRate'] = (by_dealer['withClaims'] / by_dealer['policies'] * 100).round(1)
        by_dealer['lossRatio'] = np.where(by_dealer['totalPremium'] > 0,
                                            (by_dealer['totalClaimAmount'] / by_dealer['totalPremium'] * 100).round(1), 0)
        result['byDealer'] = clean_df(by_dealer).to_dict('records')

    # Claim rate by product
    prod_col = find_column(df, ['Product', 'Coverage'])
    if prod_col:
        by_product = df.groupby(prod_col).agg(
            policies=(prod_col, 'count'),
            withClaims=('has_claim', 'sum'),
            totalPremium=('Gross Premium', 'sum') if 'Gross Premium' in df.columns else (prod_col, 'count'),
            totalClaimAmount=('total_claim_amount', 'sum'),
        ).reset_index()
        by_product.columns = ['product', 'policies', 'withClaims', 'totalPremium', 'totalClaimAmount']
        by_product['claimRate'] = (by_product['withClaims'] / by_product['policies'] * 100).round(1)
        by_product['lossRatio'] = np.where(by_product['totalPremium'] > 0,
                                            (by_product['totalClaimAmount'] / by_product['totalPremium'] * 100).round(1), 0)
        result['byProduct'] = clean_df(by_product).to_dict('records')

    # Claim rate by vehicle make (top 15)
    if 'Make' in df.columns:
        by_make = df.groupby('Make').agg(
            policies=('Make', 'count'),
            withClaims=('has_claim', 'sum'),
            totalPremium=('Gross Premium', 'sum') if 'Gross Premium' in df.columns else ('Make', 'count'),
            totalClaimAmount=('total_claim_amount', 'sum'),
        ).reset_index()
        by_make.columns = ['make', 'policies', 'withClaims', 'totalPremium', 'totalClaimAmount']
        by_make['claimRate'] = (by_make['withClaims'] / by_make['policies'] * 100).round(1)
        by_make = clean_df(by_make).sort_values('policies', ascending=False).head(15)
        result['byMake'] = by_make.to_dict('records')

    # Claim rate by year
    if 'Year' in df.columns:
        by_year = df.groupby('Year').agg(
            policies=('Year', 'count'),
            withClaims=('has_claim', 'sum'),
            totalPremium=('Gross Premium', 'sum') if 'Gross Premium' in df.columns else ('Year', 'count'),
            totalClaimAmount=('total_claim_amount', 'sum'),
        ).reset_index()
        by_year.columns = ['year', 'policies', 'withClaims', 'totalPremium', 'totalClaimAmount']
        by_year['claimRate'] = (by_year['withClaims'] / by_year['policies'] * 100).round(1)
        result['byYear'] = clean_df(by_year).to_dict('records')

    return result
