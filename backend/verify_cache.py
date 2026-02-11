
import time
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from data_processor import DataProcessor

def verify():
    p = DataProcessor()
    p.load_excel(file_path='Sales&ClaimsData.xls')
    f = {'dealer': 'All'}
    
    # 1. First run
    t0 = time.time()
    p.get_summary(f)
    d1 = time.time() - t0
    print(f"UNCACED: {d1:.6f}s")
    
    # 2. Second run
    t0 = time.time()
    p.get_summary(f)
    d2 = time.time() - t0
    print(f"CACHED:  {d2:.6f}s")
    
    if d2 < d1:
        speedup = d1 / d2 if d2 > 0 else float('inf')
        print(f"SUCCESS: Cache hit! Speedup: {speedup:.1f}x")
    else:
        print("FAILURE: No speedup")

    # 3. Invalidation
    p.update_cell('sales', p.sales_df.iloc[0]['_row_id'], 'Dealer', 'Test')
    t0 = time.time()
    p.get_summary(f)
    d3 = time.time() - t0
    print(f"POST-UPDATE: {d3:.6f}s")
    
    if d3 > d2: # Should be slower than cached
        print("SUCCESS: Cache invalidated correctly")
    else:
        print(f"FAILURE: Post-update call too fast ({d3:.6f}s)")

if __name__ == "__main__":
    verify()
