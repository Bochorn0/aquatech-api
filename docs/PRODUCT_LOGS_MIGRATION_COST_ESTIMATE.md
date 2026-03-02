# product_logs Migration – Cost Estimate (Azure PostgreSQL)

## Migration Files Summary

| File | Records | File Size | Est. DB Storage |
|------|---------|-----------|-----------------|
| product_logs_migration_2026_01.sql | 347,541 | 100 MB | ~55 MB |
| product_logs_migration_2026_02.sql | 901,470 | 260 MB | ~145 MB |
| product_logs_migration_2026_03.sql | 13,619 | 3.9 MB | ~2 MB |
| **Total** | **1,262,630** | **~364 MB** | **~200–250 MB** |

## Storage Calculation

- **Row size (approx.)**: ~160–180 bytes (id, product_id, product_device_id, numerics, timestamps, overhead)
- **1.26M rows** × 170 bytes ≈ **215 MB** raw data
- **Indexes** (product_id, product_device_id+date, date): ~20–30% extra ≈ **50 MB**
- **Total estimated**: **~250–270 MB** in PostgreSQL

## Azure Cost Impact

| Factor | Impact |
|--------|--------|
| **Storage** | ~0.25–0.3 GB additional |
| **Typical rate** | ~$0.10–0.15/GB/month (region-dependent) |
| **Extra cost** | **~$0.03–0.05/month** |

### Notes

1. **Compute**: No extra charge for running the migrations.
2. **Storage**: Only matters if you exceed your current storage limit.
3. **Backup**: Backups grow with data; usually included up to 100% of storage.
4. **Region**: Prices vary (e.g. East US vs Mexico).

## Recommendation

The migration adds about **250 MB** of data. If your plan includes at least 5 GB of storage and you are not near the limit, the cost impact is negligible (around **$0.05/month** or less).

Check current usage in Azure Portal: **PostgreSQL server → Metrics → Storage used**.
