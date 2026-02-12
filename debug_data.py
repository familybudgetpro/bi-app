from backend.core.data_manager import DataManager
import pandas as pd
import os

print("--- START DEBUG ---")
dm = DataManager()

# Try to find the file
choices = [
    'Sales&ClaimsData.xls',
    '../Sales&ClaimsData.xls',
    'c:/Users/Muhsin/source/repos/clarity-bi/Sales&ClaimsData.xls'
]

path = None
for p in choices:
    if os.path.exists(p):
        path = p
        break

if not path:
    print("X Data file not found!")
    exit(1)

print(f"Loading {path}...")
try:
    dm.load_excel(file_path=path)
    print("OK Load call complete.")
except Exception as e:
    print(f"X Load failed: {e}")
    exit(1)

if dm.sales_df is None:
    print("X sales_df is None")
else:
    print(f"OK sales_df loaded: {len(dm.sales_df)} rows")
    print("Columns:", list(dm.sales_df.columns))
    print("Head (Year/Month check):")
    cols_to_show = [c for c in ['Policy No', 'Year', 'Month', 'Policy Sold Date', 'Date'] if c in dm.sales_df.columns]
    print(dm.sales_df[cols_to_show].head().to_string())
    
    # Check if Year/Month are actually populated
    if 'Year' in dm.sales_df.columns:
        print("\nYear distribution:")
        print(dm.sales_df['Year'].value_counts().head())
    else:
        print("\nX 'Year' column INVALID/MISSING")

if dm.claims_df is None:
    print("X claims_df is None")
else:
    print(f"OK claims_df loaded: {len(dm.claims_df)} rows")

from backend.metrics import kpis
summary = kpis.get_summary(dm.sales_df, dm.claims_df, dm.merged_df, {})
print("\nKPI Summary (No filters):")
print(summary)

print("--- END DEBUG ---")
