"""
Data Processor — Core analytics engine for Sales & Claims data.
Maintains original + working copies, supports inline editing, audit trail, and recomputation.
"""

import pandas as pd
import numpy as np
from datetime import datetime
from typing import Optional, Any
import os
import io


class DataProcessor:
    def __init__(self):
        self.original_sales_df: Optional[pd.DataFrame] = None
        self.original_claims_df: Optional[pd.DataFrame] = None
        self.sales_df: Optional[pd.DataFrame] = None
        self.claims_df: Optional[pd.DataFrame] = None
        self.merged_df: Optional[pd.DataFrame] = None
        self.change_log: list[dict] = []
        self._cached_metrics: Optional[dict] = None
        self._metrics_dirty = True
        self._query_cache: dict[tuple, Any] = {}

    # ─── Loading ────────────────────────────────────────────────

    def load_excel(self, file_path: str = None, file_bytes: bytes = None):
        """Load Excel file from path or bytes."""
        if file_path:
            xls = pd.ExcelFile(file_path)
        elif file_bytes:
            xls = pd.ExcelFile(io.BytesIO(file_bytes))
        else:
            raise ValueError("Provide file_path or file_bytes")

        sheets = xls.sheet_names
        sales_sheet = next((s for s in sheets if 'sale' in s.lower()), sheets[0])
        claims_sheet = next((s for s in sheets if 'claim' in s.lower()), sheets[1] if len(sheets) > 1 else sheets[0])

        self.original_sales_df = pd.read_excel(xls, sales_sheet)
        self.original_claims_df = pd.read_excel(xls, claims_sheet)

        # Normalize column names
        self.original_sales_df.columns = [c.strip() for c in self.original_sales_df.columns]
        self.original_claims_df.columns = [c.strip() for c in self.original_claims_df.columns]

        # Add row IDs
        self.original_sales_df.insert(0, '_row_id', range(len(self.original_sales_df)))
        self.original_claims_df.insert(0, '_row_id', range(len(self.original_claims_df)))

        # Invalidate cache
        self.clear_cache()

        # Working copies
        self.sales_df = self.original_sales_df.copy()
        self.claims_df = self.original_claims_df.copy()

        # Build merged view
        self._build_merged()
        self._metrics_dirty = True
        self.change_log = []

    def _build_merged(self):
        """Link Sales and Claims by Policy No."""
        if self.sales_df is None or self.claims_df is None:
            return

        # Find the policy column (handle slight name differences)
        sales_policy_col = self._find_column(self.sales_df, ['Policy No', 'PolicyNo', 'POLICY_NO', 'Policy Number'])
        claims_policy_col = self._find_column(self.claims_df, ['Policy No', 'PolicyNo', 'POLICY_NO', 'Policy Number'])

        if sales_policy_col and claims_policy_col:
            # Aggregate claims per policy
            claims_agg = self.claims_df.groupby(claims_policy_col).agg(
                claim_count=(claims_policy_col, 'size'),
                total_claim_amount=('Total Auth Amount', 'sum') if 'Total Auth Amount' in self.claims_df.columns else (claims_policy_col, 'size'),
                total_labor=('Labor', 'sum') if 'Labor' in self.claims_df.columns else (claims_policy_col, 'size'),
                total_parts=('Parts', 'sum') if 'Parts' in self.claims_df.columns else (claims_policy_col, 'size'),
            ).reset_index()

            self.merged_df = self.sales_df.merge(
                claims_agg,
                left_on=sales_policy_col,
                right_on=claims_policy_col,
                how='left'
            )
            self.merged_df['has_claim'] = self.merged_df['claim_count'].fillna(0) > 0
            self.merged_df['claim_count'] = self.merged_df['claim_count'].fillna(0).astype(int)
            self.merged_df['total_claim_amount'] = self.merged_df['total_claim_amount'].fillna(0)
        else:
            self.merged_df = self.sales_df.copy()
            self.merged_df['has_claim'] = False
            self.merged_df['claim_count'] = 0
            self.merged_df['total_claim_amount'] = 0

    def _find_column(self, df, candidates):
        for c in candidates:
            if c in df.columns:
                return c
        return None

    # ─── Filter Helpers ─────────────────────────────────────────

    def _apply_filters(self, df: pd.DataFrame, filters: dict) -> pd.DataFrame:
        """Apply common filters to a dataframe."""
        result = df.copy()

        if filters.get('dealer') and filters['dealer'] != 'All':
            dealer_col = self._find_column(result, ['Dealer', 'Dealer AJA'])
            if dealer_col:
                result = result[result[dealer_col] == filters['dealer']]

        if filters.get('product') and filters['product'] != 'All':
            prod_col = self._find_column(result, ['Product', 'Coverage'])
            if prod_col:
                result = result[result[prod_col] == filters['product']]

        if filters.get('year') and filters['year'] != 'All':
            if 'Year' in result.columns:
                result = result[result['Year'] == int(filters['year'])]

        if filters.get('month') and filters['month'] != 'All':
            if 'Month' in result.columns:
                result = result[result['Month'] == int(filters['month'])]

        if filters.get('make') and filters['make'] != 'All':
            if 'Make' in result.columns:
                result = result[result['Make'] == filters['make']]

        if filters.get('date_from'):
            date_col = self._find_column(result, ['Policy Sold Date', 'Failure Date'])
            if date_col and date_col in result.columns:
                try:
                    result = result[pd.to_datetime(result[date_col]) >= pd.to_datetime(filters['date_from'])]
                except Exception:
                    pass

        if filters.get('date_to'):
            date_col = self._find_column(result, ['Policy Sold Date', 'Failure Date'])
            if date_col and date_col in result.columns:
                try:
                    result = result[pd.to_datetime(result[date_col]) <= pd.to_datetime(filters['date_to'])]
                except Exception:
                    pass

        if filters.get('search'):
            search = filters['search'].lower()
            mask = result.apply(lambda row: any(search in str(v).lower() for v in row), axis=1)
            result = result[mask]

        if filters.get('claim_status') and filters['claim_status'] != 'All':
            if 'Claim Status' in result.columns:
                result = result[result['Claim Status'] == filters['claim_status']]

        return result

    def _get_cache_key(self, method_name: str, filters: Optional[dict]) -> tuple:
        """Create a hashable key for caching analytical results."""
        if not filters:
            return (method_name, None)
        # Convert dict to sorted tuple of items for hashability
        filter_tuple = tuple(sorted(filters.items(), key=lambda x: x[0]))
        return (method_name, filter_tuple)

    def clear_cache(self):
        """Clear the query cache."""
        self._query_cache = {}
        self._metrics_dirty = True

    # ─── Summary / KPIs ────────────────────────────────────────

    def get_summary(self, filters: dict = None) -> dict:
        """Get overall KPI summary."""
        cache_key = self._get_cache_key('get_summary', filters)
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        if self.sales_df is None:
            return {}

        filters = filters or {}
        sales = self._apply_filters(self.sales_df, filters)
        claims = self._apply_filters(self.claims_df, filters)

        total_premium = float(sales['Gross Premium'].sum()) if 'Gross Premium' in sales.columns else 0
        total_risk_premium = float(sales['Risk Premium'].sum()) if 'Risk Premium' in sales.columns else 0
        total_claims_amount = float(claims['Total Auth Amount'].sum()) if 'Total Auth Amount' in claims.columns else 0
        total_policies = len(sales)
        total_claims = len(claims)

        policies_with_claims = 0
        if self.merged_df is not None:
            merged_filtered = self._apply_filters(self.merged_df, filters)
            policies_with_claims = int(merged_filtered['has_claim'].sum())

        claim_rate = (policies_with_claims / total_policies * 100) if total_policies > 0 else 0
        loss_ratio = (total_claims_amount / total_premium * 100) if total_premium > 0 else 0
        avg_claim_cost = (total_claims_amount / total_claims) if total_claims > 0 else 0
        avg_premium = (total_premium / total_policies) if total_policies > 0 else 0

        res = {
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
        }
        
        self._query_cache[cache_key] = res
        return res

    # ─── Filter Options ────────────────────────────────────────

    def get_filter_options(self) -> dict:
        """Return available filter values from data."""
        if self.sales_df is None:
            return {}

        options = {}

        if 'Dealer' in self.sales_df.columns:
            options['dealers'] = sorted(self.sales_df['Dealer'].dropna().unique().tolist())
        if 'Product' in self.sales_df.columns:
            options['products'] = sorted(self.sales_df['Product'].dropna().unique().tolist())
        if 'Year' in self.sales_df.columns:
            options['years'] = sorted(self.sales_df['Year'].dropna().unique().tolist())
        if 'Month' in self.sales_df.columns:
            options['months'] = sorted(self.sales_df['Month'].dropna().unique().tolist())
        if 'Make' in self.sales_df.columns:
            options['makes'] = sorted(self.sales_df['Make'].dropna().unique().tolist())
        if 'Country Name' in self.sales_df.columns:
            options['countries'] = sorted(self.sales_df['Country Name'].dropna().unique().tolist())
        if 'Coverage' in self.sales_df.columns:
            options['coverages'] = sorted(self.sales_df['Coverage'].dropna().unique().tolist())
        if 'Vehicle Type' in self.sales_df.columns:
            options['vehicleTypes'] = sorted(self.sales_df['Vehicle Type'].dropna().unique().tolist())
        if 'Body Type' in self.sales_df.columns:
            options['bodyTypes'] = sorted(self.sales_df['Body Type'].dropna().unique().tolist())

        # Claims-specific
        if self.claims_df is not None:
            if 'Claim Status' in self.claims_df.columns:
                options['claimStatuses'] = sorted(self.claims_df['Claim Status'].dropna().unique().tolist())
            if 'Part Type' in self.claims_df.columns:
                options['partTypes'] = sorted(self.claims_df['Part Type'].dropna().unique().tolist())

        # Date Range
        date_col = self._find_column(self.sales_df, ['Policy Sold Date', 'Failure Date'])
        if date_col and date_col in self.sales_df.columns:
            try:
                dates = pd.to_datetime(self.sales_df[date_col], errors='coerce').dropna()
                if not dates.empty:
                    options['minDate'] = dates.min().strftime('%Y-%m-%d')
                    options['maxDate'] = dates.max().strftime('%Y-%m-%d')
            except Exception:
                pass

        return options

    # ─── Sales Endpoints ───────────────────────────────────────

    def get_sales_monthly(self, filters: dict = None) -> list[dict]:
        """Monthly sales trends."""
        cache_key = self._get_cache_key('get_sales_monthly', filters)
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        if self.sales_df is None:
            return []

        filters = filters or {}
        df = self._apply_filters(self.sales_df, filters)

        if 'Year' not in df.columns or 'Month' not in df.columns:
            return []

        grouped = df.groupby(['Year', 'Month']).agg(
            premium=('Gross Premium', 'sum'),
            riskPremium=('Risk Premium', 'sum'),
            policies=('Policy No', 'count') if 'Policy No' in df.columns else ('Year', 'count'),
        ).reset_index()

        grouped = grouped.sort_values(['Year', 'Month'])
        grouped['period'] = grouped['Year'].astype(str) + '-' + grouped['Month'].astype(str).str.zfill(2)

        res = grouped.to_dict('records')
        self._query_cache[cache_key] = res
        return res

    def get_sales_dealers(self, filters: dict = None) -> list[dict]:
        """Dealer performance breakdown."""
        cache_key = self._get_cache_key('get_sales_dealers', filters)
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        if self.sales_df is None:
            return []

        filters = filters or {}
        df = self._apply_filters(self.sales_df, filters)
        dealer_col = self._find_column(df, ['Dealer'])
        if not dealer_col:
            return []

        grouped = df.groupby(dealer_col).agg(
            premium=('Gross Premium', 'sum'),
            riskPremium=('Risk Premium', 'sum'),
            policies=('Policy No', 'count') if 'Policy No' in df.columns else (dealer_col, 'count'),
        ).reset_index()
        grouped.columns = ['dealer', 'premium', 'riskPremium', 'policies']

        # Add claim info from merged
        if self.merged_df is not None:
            merged_f = self._apply_filters(self.merged_df, filters)
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

        res = grouped.to_dict('records')
        self._query_cache[cache_key] = res
        return res

    def get_sales_products(self, filters: dict = None) -> list[dict]:
        """Product mix breakdown."""
        cache_key = self._get_cache_key('get_sales_products', filters)
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        if self.sales_df is None:
            return []

        filters = filters or {}
        df = self._apply_filters(self.sales_df, filters)
        prod_col = self._find_column(df, ['Product', 'Coverage'])
        if not prod_col:
            return []

        grouped = df.groupby(prod_col).agg(
            premium=('Gross Premium', 'sum'),
            riskPremium=('Risk Premium', 'sum'),
            count=('Policy No', 'count') if 'Policy No' in df.columns else (prod_col, 'count'),
        ).reset_index()
        grouped.columns = ['product', 'premium', 'riskPremium', 'count']

        res = grouped.to_dict('records')
        self._query_cache[cache_key] = res
        return res

    def get_sales_vehicles(self, filters: dict = None) -> list[dict]:
        """Vehicle make breakdown."""
        cache_key = self._get_cache_key('get_sales_vehicles', filters)
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        if self.sales_df is None:
            return []

        filters = filters or {}
        df = self._apply_filters(self.sales_df, filters)

        if 'Make' not in df.columns:
            return []

        grouped = df.groupby('Make').agg(
            premium=('Gross Premium', 'sum'),
            count=('Policy No', 'count') if 'Policy No' in df.columns else ('Make', 'count'),
        ).reset_index()
        grouped.columns = ['make', 'premium', 'count']
        grouped = grouped.sort_values('count', ascending=False).head(20)

        res = grouped.to_dict('records')
        self._query_cache[cache_key] = res
        return res

    # ─── Claims Endpoints ──────────────────────────────────────

    def get_claims_status(self, filters: dict = None) -> list[dict]:
        """Claim status distribution."""
        cache_key = self._get_cache_key('get_claims_status', filters)
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        if self.claims_df is None:
            return []

        filters = filters or {}
        df = self._apply_filters(self.claims_df, filters)

        if 'Claim Status' not in df.columns:
            return []

        grouped = df.groupby('Claim Status').agg(
            count=('Policy No', 'count') if 'Policy No' in df.columns else ('Claim Status', 'count'),
            totalAmount=('Total Auth Amount', 'sum') if 'Total Auth Amount' in df.columns else ('Claim Status', 'count'),
        ).reset_index()
        grouped.columns = ['status', 'count', 'totalAmount']

        colors = {'Approved': '#10b981', 'Rejected': '#ef4444', 'Reversed': '#f59e0b', 'Pending': '#3b82f6'}
        grouped['color'] = grouped['status'].map(lambda s: colors.get(s, '#64748b'))

        res = grouped.to_dict('records')
        self._query_cache[cache_key] = res
        return res

    def get_claims_parts(self, filters: dict = None) -> list[dict]:
        """Part type failure analysis."""
        cache_key = self._get_cache_key('get_claims_parts', filters)
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        if self.claims_df is None:
            return []

        filters = filters or {}
        df = self._apply_filters(self.claims_df, filters)

        if 'Part Type' not in df.columns:
            return []

        grouped = df.groupby('Part Type').agg(
            count=('Policy No', 'count') if 'Policy No' in df.columns else ('Part Type', 'count'),
            totalAmount=('Total Auth Amount', 'sum') if 'Total Auth Amount' in df.columns else ('Part Type', 'count'),
            avgCost=('Total Auth Amount', 'mean') if 'Total Auth Amount' in df.columns else ('Part Type', 'count'),
        ).reset_index()
        grouped.columns = ['partType', 'count', 'totalAmount', 'avgCost']
        grouped = grouped.sort_values('count', ascending=False)

        res = grouped.to_dict('records')
        self._query_cache[cache_key] = res
        return res

    def get_claims_trends(self, filters: dict = None) -> list[dict]:
        """Monthly claim trends."""
        cache_key = self._get_cache_key('get_claims_trends', filters)
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        if self.claims_df is None:
            return []

        filters = filters or {}
        df = self._apply_filters(self.claims_df, filters)

        if 'Year' not in df.columns or 'Month' not in df.columns:
            return []

        grouped = df.groupby(['Year', 'Month']).agg(
            count=('Policy No', 'count') if 'Policy No' in df.columns else ('Year', 'count'),
            totalAmount=('Total Auth Amount', 'sum') if 'Total Auth Amount' in df.columns else ('Year', 'count'),
            laborCost=('Labor', 'sum') if 'Labor' in df.columns else ('Year', 'count'),
            partsCost=('Parts', 'sum') if 'Parts' in df.columns else ('Year', 'count'),
        ).reset_index()
        grouped = grouped.sort_values(['Year', 'Month'])
        grouped['period'] = grouped['Year'].astype(str) + '-' + grouped['Month'].astype(str).str.zfill(2)

        res = grouped.to_dict('records')
        self._query_cache[cache_key] = res
        return res

    def get_claims_recent(self, filters: dict = None, limit: int = 50) -> list[dict]:
        """Recent claims table data."""
        cache_key = self._get_cache_key('get_claims_recent', filters)
        # Add limit to cache key if needed, or just cache the result of the filters
        # For simplicity, let's include limit in the name if we want to be exact
        cache_key = (f'get_claims_recent_{limit}', cache_key[1])
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        if self.claims_df is None:
            return []

        filters = filters or {}
        df = self._apply_filters(self.claims_df, filters)

        date_col = self._find_column(df, ['Failure Date', 'Authorized Date'])
        if date_col:
            df = df.sort_values(date_col, ascending=False)

        result = df.head(limit).copy()
        # Convert dates to strings
        for col in result.columns:
            if result[col].dtype == 'datetime64[ns]':
                result[col] = result[col].dt.strftime('%Y-%m-%d')
        result = result.drop(columns=['_row_id'], errors='ignore')

        res = result.to_dict('records')
        self._query_cache[cache_key] = res
        return res

    # ─── Correlations ──────────────────────────────────────────

    def get_correlations(self, filters: dict = None) -> dict:
        """Sales-Claims correlations."""
        cache_key = self._get_cache_key('get_correlations', filters)
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        if self.merged_df is None:
            return {}

        filters = filters or {}
        df = self._apply_filters(self.merged_df, filters)

        result = {}

        # Claim rate by dealer
        dealer_col = self._find_column(df, ['Dealer'])
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
            result['byDealer'] = by_dealer.to_dict('records')

        # Claim rate by product
        prod_col = self._find_column(df, ['Product', 'Coverage'])
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
            result['byProduct'] = by_product.to_dict('records')

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
            by_make = by_make.sort_values('policies', ascending=False).head(15)
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
            result['byYear'] = by_year.to_dict('records')

        self._query_cache[cache_key] = result
        return result

    # ─── Raw Data (Paginated) ──────────────────────────────────

    def get_raw_data(self, table: str, page: int = 1, limit: int = 100,
                     filters: dict = None, sort_by: str = None, sort_dir: str = 'asc') -> dict:
        """Get paginated raw data for Data Manager."""
        if table == 'sales':
            df = self.sales_df
        elif table == 'claims':
            df = self.claims_df
        else:
            return {'rows': [], 'total': 0, 'page': 1, 'pages': 0}

        if df is None:
            return {'rows': [], 'total': 0, 'page': 1, 'pages': 0}

        filters = filters or {}
        df = self._apply_filters(df, filters)

        # Sort
        if sort_by and sort_by in df.columns:
            df = df.sort_values(sort_by, ascending=(sort_dir == 'asc'))

        total = len(df)
        pages = max(1, (total + limit - 1) // limit)
        page = max(1, min(page, pages))
        start = (page - 1) * limit
        end = start + limit

        result = df.iloc[start:end].copy()

        # Convert dates safely
        for col in result.columns:
            if result[col].dtype == 'datetime64[ns]':
                result[col] = result[col].dt.strftime('%Y-%m-%d')

        columns = [c for c in result.columns if c != '_row_id']

        return {
            'rows': result.to_dict('records'),
            'columns': columns,
            'total': total,
            'page': page,
            'pages': pages,
            'limit': limit,
        }

    # ─── Inline Editing ────────────────────────────────────────

    def update_cell(self, table: str, row_id: int, column: str, new_value: Any) -> dict:
        """Update a single cell and recompute metrics."""
        df = self.sales_df if table == 'sales' else self.claims_df
        if df is None:
            return {'success': False, 'error': 'No data loaded'}

        if column not in df.columns:
            return {'success': False, 'error': f'Column {column} not found'}

        if column == '_row_id':
            return {'success': False, 'error': 'Cannot edit row ID'}

        mask = df['_row_id'] == row_id
        if not mask.any():
            return {'success': False, 'error': f'Row {row_id} not found'}

        old_value = df.loc[mask, column].values[0]

        # Type validation
        validated_value, error = self._validate_value(table, column, new_value)
        if error:
            return {'success': False, 'error': error}

        # Apply change
        df.loc[mask, column] = validated_value

        # Invalidate cache
        self.clear_cache()

        # Log change
        self.change_log.append({
            'timestamp': datetime.now().isoformat(),
            'table': table,
            'row_id': row_id,
            'column': column,
            'old_value': self._serialize(old_value),
            'new_value': self._serialize(validated_value),
        })

        # Recompute
        self._build_merged()
        self._metrics_dirty = True

        return {'success': True, 'old_value': self._serialize(old_value), 'new_value': self._serialize(validated_value)}

    def bulk_update(self, table: str, updates: list[dict]) -> dict:
        """Bulk update multiple cells."""
        results = []
        for u in updates:
            r = self.update_cell(table, u['row_id'], u['column'], u['new_value'])
            results.append(r)
        return {'results': results, 'success': all(r['success'] for r in results)}

    def _validate_value(self, table: str, column: str, value: Any) -> tuple[Any, Optional[str]]:
        """Validate and coerce value types."""
        numeric_cols = {
            'sales': ['Gross Premium', 'Risk Premium', 'CC', 'Cylinder', 'Start KM', 'End KM', 'Year', 'Month'],
            'claims': ['Labor', 'Parts', 'Total Auth Amount', 'Claim KM', 'CC', 'Year', 'Month'],
        }
        valid_statuses = ['Approved', 'Rejected', 'Reversed']

        if column in numeric_cols.get(table, []):
            try:
                val = float(value)
                if column in ['Gross Premium', 'Risk Premium'] and val < 0:
                    return None, f'{column} must be >= 0'
                if column in ['Total Auth Amount', 'Labor', 'Parts'] and val < 0:
                    return None, f'{column} must be >= 0'
                return val, None
            except (ValueError, TypeError):
                return None, f'{column} must be numeric'

        if column == 'Claim Status' and value not in valid_statuses:
            return None, f'Claim Status must be one of: {valid_statuses}'

        return value, None

    def _serialize(self, val):
        """Safely serialize a value."""
        if pd.isna(val):
            return None
        if isinstance(val, (np.integer,)):
            return int(val)
        if isinstance(val, (np.floating,)):
            return float(val)
        if isinstance(val, pd.Timestamp):
            return val.isoformat()
        return val

    # ─── Reset & Export ────────────────────────────────────────

    def reset_data(self) -> dict:
        """Reset to original uploaded data."""
        if self.original_sales_df is None:
            return {'success': False, 'error': 'No data loaded'}

        self.sales_df = self.original_sales_df.copy()
        self.claims_df = self.original_claims_df.copy()
        self._build_merged()
        self.clear_cache()

        changes_reverted = len(self.change_log)
        self.change_log = []

        return {'success': True, 'changesReverted': changes_reverted}

    def export_data(self, table: str) -> bytes:
        """Export current working data as Excel bytes."""
        df = self.sales_df if table == 'sales' else self.claims_df
        if df is None:
            return b''

        output = io.BytesIO()
        export_df = df.drop(columns=['_row_id'], errors='ignore')
        export_df.to_excel(output, index=False, engine='openpyxl')
        return output.getvalue()

    def get_change_log(self) -> list[dict]:
        """Return the audit trail."""
        return self.change_log

    # ─── Data Summary for AI Context ───────────────────────────

    def get_data_summary_for_ai(self, filters: dict = None) -> str:
        """Generate a text summary for Gemini context."""
        summary = self.get_summary(filters)
        if not summary:
            return "No data loaded."

        filter_opts = self.get_filter_options()

        text = f"""INSURANCE DATA SUMMARY:
- Total Policies: {summary['totalPolicies']:,}
- Total Gross Premium: {summary['totalPremium']:,.2f}
- Total Claims: {summary['totalClaims']:,}
- Total Claims Amount: {summary['totalClaimsAmount']:,.2f}
- Claim Rate: {summary['claimRate']}%
- Loss Ratio: {summary['lossRatio']}%
- Average Claim Cost: {summary['avgClaimCost']:,.2f}
- Average Premium: {summary['avgPremium']:,.2f}
- Unique Dealers: {summary['uniqueDealers']}
- Unique Vehicle Makes: {summary['uniqueMakes']}

AVAILABLE DATA DIMENSIONS:
- Dealers: {', '.join(filter_opts.get('dealers', []))}
- Products: {', '.join(filter_opts.get('products', []))}
- Years: {', '.join(str(y) for y in filter_opts.get('years', []))}
- Claim Statuses: {', '.join(filter_opts.get('claimStatuses', []))}
- Part Types: {', '.join(filter_opts.get('partTypes', [])[:10])}
- Top Makes: {', '.join(filter_opts.get('makes', [])[:15])}
"""
        return text

    # ─── Insights & Forecast ───────────────────────────────────

    def get_insights(self, filters: dict = None) -> list[dict]:
        """Generate automatic insights and forecasts."""
        cache_key = self._get_cache_key('get_insights', filters)
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        insights = []
        if self.sales_df is None:
            return insights

        summary = self.get_summary(filters)
        
        # 1. Loss Ratio Analysis
        lr = summary.get('lossRatio', 0)
        if lr > 80:
            insights.append({
                "type": "warning",
                "title": "High Loss Ratio Alert",
                "description": f"Overall loss ratio is {lr}%, which is critical. Review high-risk dealers immediately.",
                "metric": f"{lr}%",
                "trend": "down"
            })
        elif lr > 60:
            insights.append({
                "type": "warning",
                "title": "Elevated Loss Ratio",
                "description": f"Loss ratio of {lr}% is above the healthy threshold of 60%.",
                "metric": f"{lr}%",
                "trend": "neutral"
            })
        else:
             insights.append({
                "type": "success",
                "title": "Healthy Performance",
                "description": f"Loss ratio of {lr}% is within profitable range.",
                "metric": f"{lr}%",
                "trend": "up"
            })

        # 2. Dealer Performance (Best & Worst)
        dealers = self.get_sales_dealers(filters)
        if dealers:
            # Sort by policies for relevance, then loss ratio
            major_dealers = [d for d in dealers if d['policies'] > 10] # Filter small data
            if major_dealers:
                worst_dealer = max(major_dealers, key=lambda x: x.get('lossRatio', 0))
                best_dealer = max(major_dealers, key=lambda x: x.get('premium', 0))

                if worst_dealer.get('lossRatio', 0) > 100:
                    insights.append({
                        "type": "danger",
                        "title": "Critical Dealer Risk",
                        "description": f"Dealer {worst_dealer['dealer']} has {worst_dealer['lossRatio']}% loss ratio.",
                        "metric": f"{worst_dealer['lossRatio']}% LR",
                        "trend": "down"
                    })
                
                insights.append({
                    "type": "info",
                    "title": "Top Performer",
                    "description": f"Dealer {best_dealer['dealer']} leads with {best_dealer['premium']:,.0f} in premium.",
                    "metric": f"{best_dealer['policies']} Policies",
                    "trend": "up"
                })

        # 3. Simple Forecast (Next Month)
        monthly = self.get_sales_monthly(filters)
        if len(monthly) >= 3:
            # Simple moving average of last 3 months
            last_3 = monthly[-3:]
            avg_growth = 0
            if len(last_3) > 1:
                # Calculate simple month-over-month growth rate
                growth_rates = []
                for i in range(1, len(last_3)):
                    prev = last_3[i-1]['premium']
                    curr = last_3[i]['premium']
                    if prev > 0:
                        growth_rates.append((curr - prev) / prev)
                
                if growth_rates:
                    avg_growth = sum(growth_rates) / len(growth_rates)

            last_prem = monthly[-1]['premium']
            forecast_prem = last_prem * (1 + avg_growth)
            
            direction = "growing" if avg_growth >= 0 else "declining"
            
            insights.append({
                "type": "forecast",
                "title": "Sales Forecast",
                "description": f"Based on recent trends, next month's premium is projected to be around {forecast_prem:,.0f} ({avg_growth*100:+.1f}%).",
                "metric": f"{forecast_prem:,.0f}",
                "trend": "up" if avg_growth > 0 else "down"
            })

        self._query_cache[cache_key] = insights
        return insights

    # ─── Data Validation ───────────────────────────────────────

    def validate_data(self) -> dict:
        """Validate loaded data for critical issues."""
        issues = []
        status = "valid"

        if self.sales_df is None:
            return {"status": "error", "issues": ["No data loaded"]}

        # 1. Check Required Columns
        required_sales_cols = ['Policy No', 'Dealer', 'Product', 'Year', 'Month', 'Premium']
        missing_sales = [col for col in required_sales_cols if col not in self.sales_df.columns]
        if missing_sales:
            issues.append({"type": "error", "message": f"Missing required Sales columns: {', '.join(missing_sales)}"})
            status = "error"

        if self.claims_df is not None:
             required_claims_cols = ['Policy No', 'Claim Status', 'Total Auth Amount']
             missing_claims = [col for col in required_claims_cols if col not in self.claims_df.columns]
             if missing_claims:
                 issues.append({"type": "error", "message": f"Missing required Claims columns: {', '.join(missing_claims)}"})
                 status = "error"

        # 2. Check for Duplicates (Policy No should be unique in Sales)
        if 'Policy No' in self.sales_df.columns:
            duplicates = self.sales_df.duplicated(subset=['Policy No']).sum()
            if duplicates > 0:
                issues.append({"type": "warning", "message": f"Found {duplicates} duplicate Policy Numbers in Sales data."})
                if status == "valid": status = "warning"

        # 3. Check Data Types (Premium should be numeric)
        if 'Premium' in self.sales_df.columns:
            non_numeric = pd.to_numeric(self.sales_df['Premium'], errors='coerce').isna().sum()
            if non_numeric > 0:
                issues.append({"type": "warning", "message": f"Found {non_numeric} non-numeric values in Premium column."})
                if status == "valid": status = "warning"

        return {"status": status, "issues": issues}
