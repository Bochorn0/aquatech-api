# product_logs: Why COUNT is slow and how to handle it

## Why `SELECT COUNT(id) FROM product_logs` takes ~6 seconds

PostgreSQL must **read every row** (or the whole primary key index) to return an exact count. There is no stored “total rows” value. On a table with millions of rows this means a full scan and often **several seconds**, depending on size and disk.

So the slowness is **expected** for an unbounded exact count, not a bug.

---

## Options

### 1. **Approximate count (instant)** – for dashboards / admin

Use the function added in migration **038**:

```sql
SELECT approximate_count_product_logs();
```

- Returns the planner’s row estimate (`pg_class.reltuples`).
- **Instant** (no table scan).
- Updated when `ANALYZE product_logs;` runs (e.g. via autovacuum).
- Typically within a few percent of the real count; can be off after big bulk inserts until the next ANALYZE.

Refresh the estimate when needed:

```sql
ANALYZE product_logs;
```

Use this whenever an **approximate** number is enough (e.g. “about 1.2M logs”).

---

### 2. **Exact count (when you really need it)**

- **Run during low load** so the long scan doesn’t compete with reporting/API.
- **Use parallelism** to shorten the scan (same total work, spread across cores):

  ```sql
  SET max_parallel_workers_per_gather = 4;
  SELECT COUNT(*) FROM product_logs;
  ```

- The app’s **filtered** counts (e.g. by `product_id` and `date`) use indexes (see migration 036) and stay fast; only the **unbounded** full-table count is slow.

---

### 3. **Avoid full-table count in the app**

- Do not call `ProductLogModel.count({})` (no filters) in hot paths.
- For “how many logs” in the UI, prefer the approximate count (e.g. an endpoint that runs `approximate_count_product_logs()`).
- For reporting, keep using filtered counts (by punto/product and date); they are indexed and fast.

---

## Summary

| Need              | Solution                                      |
|-------------------|-----------------------------------------------|
| Dashboard / admin | `SELECT approximate_count_product_logs();`   |
| Exact count rarely| Run `COUNT(*)` off-peak, optionally with parallel workers |
| Report / API      | Filtered counts only (product_id + date); already optimized with indexes |
