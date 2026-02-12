from backend.core.data_manager import DataManager
from backend.metrics import kpis, sales, claims
import json
import numpy as np

dm = DataManager()
dm.load_excel(file_path='Sales&ClaimsData.xls')

filters = {
    'date_from': '2018-02-02',
    'date_to': '2019-02-09'
}

print(f"Testing filters: {filters}")

def test_endpoint(name, func, *args):
    print(f"\n--- Testing {name} ---")
    try:
        res = func(*args, filters=filters)
        # Try to JSON serialize
        j = json.dumps(res)
        print(f"OK {name} SUCCESS (JSON length: {len(j)})")
        if isinstance(res, dict) and 'lossRatio' in res:
             print(f"Loss Ratio: {res['lossRatio']}")
    except Exception as e:
        print(f"FAIL {name} FAILED: {e}")

test_endpoint("Summary", kpis.get_summary, dm.sales_df, dm.claims_df, dm.merged_df)
test_endpoint("Monthly Sales", sales.get_sales_monthly, dm.sales_df)
test_endpoint("Correlations", kpis.get_correlations, dm.merged_df)
test_endpoint("Claims Status", claims.get_claims_status, dm.claims_df)

print("\n--- Test End ---")
