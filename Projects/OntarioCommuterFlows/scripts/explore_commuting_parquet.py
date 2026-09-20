from pathlib import Path
import duckdb
import pandas as pd

# INPUT PARQUET FILE
parquet_file = Path(
    "...Ontario_Quebec_Manitoba_commuting.parquet"
)

# OUTPUT FILE
output_file = Path(
    "...commuting_parquet_summary_with_geographies.xlsx"
)

con = duckdb.connect()

# TOTAL ROW COUNT
total_rows = con.execute(f"""
    SELECT COUNT(*) AS total_rows
    FROM read_parquet('{parquet_file}')
""").fetchone()[0]

print("\nTOTAL ROWS")
print(total_rows)

# COUNT BY PROVINCE
province_counts = con.execute(f"""
    SELECT
        Province,
        COUNT(*) AS row_count
    FROM read_parquet('{parquet_file}')
    GROUP BY Province
    ORDER BY Province
""").df()

print("\nCOUNT BY PROVINCE")
print(province_counts.to_string(index=False))

# UNIQUE DGUIDS BY PROVINCE
unique_geographies = con.execute(f"""
    SELECT
        Province,
        COUNT(DISTINCT DGUID) AS unique_dguids,
        COUNT(*) AS total_rows,
        ROUND(
            COUNT(*) * 1.0 / COUNT(DISTINCT DGUID),
            1
        ) AS rows_per_dguid
    FROM read_parquet('{parquet_file}')
    GROUP BY Province
    ORDER BY Province
""").df()

print("\nUNIQUE DGUIDS BY PROVINCE")
print(unique_geographies.to_string(index=False))

# CREATE SUMMARY DATAFRAME
summary = pd.DataFrame({
    "Metric": ["Total rows"],
    "Value": [total_rows]
})

# GET PROVINCES
provinces = con.execute(f"""
    SELECT DISTINCT Province
    FROM read_parquet('{parquet_file}')
    WHERE Province IS NOT NULL
    ORDER BY Province
""").fetchall()

# EXPORT TO EXCEL
with pd.ExcelWriter(output_file, engine="openpyxl") as writer:

    summary.to_excel(
        writer,
        sheet_name="Summary",
        index=False
    )

    province_counts.to_excel(
        writer,
        sheet_name="Province_Counts",
        index=False
    )

    unique_geographies.to_excel(
        writer,
        sheet_name="Unique_DGUIDs",
        index=False
    )

    for province_tuple in provinces:
        province = province_tuple[0]

        sample = con.execute(f"""
            SELECT *
            FROM read_parquet('{parquet_file}')
            WHERE Province = ?
            LIMIT 10
        """, [province]).df()

        print(f"\n10 SAMPLE ROWS - {province.upper()}")
        print(sample.to_string(index=False))

        sample.to_excel(
            writer,
            sheet_name=f"{province}_Sample",
            index=False
        )

con.close()

print()
print(f"Saved: {output_file}")