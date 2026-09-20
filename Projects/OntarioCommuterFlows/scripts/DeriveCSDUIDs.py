from pathlib import Path
from datetime import datetime
import duckdb

# INPUT FILE
input_file = Path(
    "...Ontario_Quebec_Manitoba_commuting_Work_DGUID_20260919_203919.parquet"
)

# OUTPUT FOLDER
output_folder = Path(
    "...Data"
)

# TIMESTAMP
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

# OUTPUT FILE
output_file = output_folder / (
    f"Ontario_Quebec_Manitoba_commuting_CSDUID_{timestamp}.parquet"
)

con = duckdb.connect()

# ADD HOME AND WORK CSDUID FIELDS
con.execute(f"""
    COPY (
        SELECT
            *,
            RIGHT(CAST(DGUID AS VARCHAR), 7) AS Home_CSDUID,
            CASE
                WHEN Work_DGUID IS NOT NULL
                THEN RIGHT(CAST(Work_DGUID AS VARCHAR), 7)
                ELSE NULL
            END AS Work_CSDUID
        FROM read_parquet('{input_file}')
    )
    TO '{output_file}'
    (FORMAT PARQUET)
""")

# VALIDATE SAMPLE
sample = con.execute(f"""
    SELECT
        DGUID,
        Home_CSDUID,
        Work_DGUID,
        Work_CSDUID
    FROM read_parquet('{output_file}')
    LIMIT 20
""").df()

print(sample.to_string(index=False))

# ROW COUNT
row_count = con.execute(f"""
    SELECT COUNT(*)
    FROM read_parquet('{output_file}')
""").fetchone()[0]

con.close()

print()
print("Rows:", row_count)
print("Saved:")
print(output_file)