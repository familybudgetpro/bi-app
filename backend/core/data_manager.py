import pandas as pd
import numpy as np
from datetime import datetime
from typing import Optional, Any
import io
from backend.core.utils import find_column
from backend.metrics import kpis

class DataManager:
    def __init__(self):
        self.original_sales_df: Optional[pd.DataFrame] = None
        self.original_claims_df: Optional[pd.DataFrame] = None
        self.sales_df: Optional[pd.DataFrame] = None
        self.claims_df: Optional[pd.DataFrame] = None
        self.merged_df: Optional[pd.DataFrame] = None
        self.change_log: list[dict] = []
        self._query_cache: dict[tuple, Any] = {}
        self._metrics_dirty = True

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

        # Ensure Year/Month exist
        self._ensure_date_columns(self.original_sales_df)
        self._ensure_date_columns(self.original_claims_df)

        self.clear_cache()
        self.sales_df = self.original_sales_df.copy()
        self.claims_df = self.original_claims_df.copy()
        self._build_merged()
        self.change_log = []

    def _ensure_date_columns(self, df: pd.DataFrame):
        """Derive Year and Month from date columns if missing."""
        if df is None: return
        
        # Check if we need to add them
        if 'Year' in df.columns and 'Month' in df.columns:
            return

        date_col = find_column(df, ['Policy Sold Date', 'Failure Date', 'Date', 'Invoice Date'])
        if date_col:
            try:
                # Convert to datetime if not already
                if not pd.api.types.is_datetime64_any_dtype(df[date_col]):
                    df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
                
                if 'Year' not in df.columns:
                    df['Year'] = df[date_col].dt.year.fillna(0).astype(int)
                if 'Month' not in df.columns:
                    df['Month'] = df[date_col].dt.month.fillna(0).astype(int)
            except Exception as e:
                print(f"Error deriving Year/Month from {date_col}: {e}")

    def _build_merged(self):
        """Link Sales and Claims by Policy No."""
        if self.sales_df is None or self.claims_df is None:
            return

        sales_policy_col = find_column(self.sales_df, ['Policy No', 'PolicyNo', 'POLICY_NO', 'Policy Number'])
        claims_policy_col = find_column(self.claims_df, ['Policy No', 'PolicyNo', 'POLICY_NO', 'Policy Number'])

        if sales_policy_col and claims_policy_col:
            claims_agg = self.claims_df.groupby(claims_policy_col).agg(
                claim_count=(claims_policy_col, 'size'),
                total_claim_amount=('Total Auth Amount', 'sum') if 'Total Auth Amount' in self.claims_df.columns else (claims_policy_col, 'size'),
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

    def clear_cache(self):
        self._query_cache = {}
        self._metrics_dirty = True

    def get_cache_key(self, method_name: str, filters: Optional[dict]) -> tuple:
        if not filters:
            return (method_name, None)
        filter_tuple = tuple(sorted(filters.items(), key=lambda x: x[0]))
        return (method_name, filter_tuple)

    def cache_result(self, key, value):
        self._query_cache[key] = value
        return value

    def get_cached(self, key):
        return self._query_cache.get(key)

    # ─── Filter Options ────────────────────────────────────────

    def get_filter_options(self) -> dict:
        """Return available filter values from data."""
        if self.sales_df is None:
            return {}

        options = {}
        for col, key in [
            ('Dealer', 'dealers'), ('Product', 'products'), ('Year', 'years'),
            ('Month', 'months'), ('Make', 'makes'), ('Country Name', 'countries'),
            ('Coverage', 'coverages'), ('Vehicle Type', 'vehicleTypes'), ('Body Type', 'bodyTypes')
        ]:
            if col in self.sales_df.columns:
                options[key] = sorted(self.sales_df[col].dropna().unique().tolist())

        if self.claims_df is not None:
            if 'Claim Status' in self.claims_df.columns:
                options['claimStatuses'] = sorted(self.claims_df['Claim Status'].dropna().unique().tolist())
            if 'Part Type' in self.claims_df.columns:
                options['partTypes'] = sorted(self.claims_df['Part Type'].dropna().unique().tolist())

        date_col = find_column(self.sales_df, ['Policy Sold Date', 'Failure Date'])
        if date_col and date_col in self.sales_df.columns:
            try:
                dates = pd.to_datetime(self.sales_df[date_col], errors='coerce').dropna()
                if not dates.empty:
                    options['minDate'] = dates.min().strftime('%Y-%m-%d')
                    options['maxDate'] = dates.max().strftime('%Y-%m-%d')
            except Exception:
                pass

        return options

    # ─── Data Summary for AI ───────────────────────────────────

    def get_data_summary_for_ai(self, filters: dict = None) -> str:
        """Generate a text summary for Gemini context."""
        summary = kpis.get_summary(self.sales_df, self.claims_df, self.merged_df, filters)
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
- Unique Makes: {summary['uniqueMakes']}

AVAILABLE DATA DIMENSIONS:
- Dealers: {', '.join(filter_opts.get('dealers', []))}
- Products: {', '.join(filter_opts.get('products', []))}
- Years: {', '.join(str(y) for y in filter_opts.get('years', []))}
- Claim Statuses: {', '.join(filter_opts.get('claimStatuses', []))}
"""
        return text

    # ─── Raw Data (Paginated) ──────────────────────────────────

    def get_raw_data(self, table: str, page: int = 1, limit: int = 100,
                     filters: dict = None, sort_by: str = None, sort_dir: str = 'asc') -> dict:
        """Get paginated raw data for Data Manager."""
        from backend.core.utils import apply_filters
        
        if table == 'sales':
            df = self.sales_df
        elif table == 'claims':
            df = self.claims_df
        else:
            return {'rows': [], 'total': 0, 'page': 1, 'pages': 0}

        if df is None:
            return {'rows': [], 'total': 0, 'page': 1, 'pages': 0}

        filters = filters or {}
        df = apply_filters(df, filters)

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
        df = self.sales_df if table == 'sales' else self.claims_df
        if df is None: return {'success': False, 'error': 'No data loaded'}
        if column not in df.columns: return {'success': False, 'error': f'Column {column} not found'}
        if column == '_row_id': return {'success': False, 'error': 'Cannot edit row ID'}

        mask = df['_row_id'] == row_id
        if not mask.any(): return {'success': False, 'error': f'Row {row_id} not found'}

        old_value = df.loc[mask, column].values[0]
        validated_value, error = self._validate_value(table, column, new_value)
        if error: return {'success': False, 'error': error}

        df.loc[mask, column] = validated_value
        self.clear_cache()
        self.change_log.append({
            'timestamp': datetime.now().isoformat(),
            'table': table, 'row_id': row_id, 'column': column,
            'old_value': self._serialize(old_value), 'new_value': self._serialize(validated_value),
        })
        self._build_merged()
        return {'success': True, 'old_value': self._serialize(old_value), 'new_value': self._serialize(validated_value)}

    def bulk_update(self, table: str, updates: list[dict]) -> dict:
        results = []
        for u in updates:
            r = self.update_cell(table, u['row_id'], u['column'], u['new_value'])
            results.append(r)
        return {'results': results, 'success': all(r['success'] for r in results)}

    def _validate_value(self, table: str, column: str, value: Any) -> tuple[Any, Optional[str]]:
        numeric_cols = {
            'sales': ['Gross Premium', 'Risk Premium', 'CC', 'Year', 'Month'],
            'claims': ['Labor', 'Parts', 'Total Auth Amount', 'Year', 'Month'],
        }
        if column in numeric_cols.get(table, []):
            try:
                val = float(value)
                return val, None
            except (ValueError, TypeError):
                return None, f'{column} must be numeric'
        return value, None

    def _serialize(self, val):
        if pd.isna(val): return None
        if isinstance(val, (np.integer,)): return int(val)
        if isinstance(val, (np.floating,)): return float(val)
        if isinstance(val, pd.Timestamp): return val.isoformat()
        return val

    def reset_data(self) -> dict:
        if self.original_sales_df is None: return {'success': False, 'error': 'No data loaded'}
        self.sales_df = self.original_sales_df.copy()
        self.claims_df = self.original_claims_df.copy()
        self._build_merged()
        self.clear_cache()
        self.change_log = []
        return {'success': True}

    def export_data(self, table: str) -> bytes:
        df = self.sales_df if table == 'sales' else self.claims_df
        if df is None: return b''
        output = io.BytesIO()
        df.drop(columns=['_row_id'], errors='ignore').to_excel(output, index=False, engine='openpyxl')
        return output.getvalue()
