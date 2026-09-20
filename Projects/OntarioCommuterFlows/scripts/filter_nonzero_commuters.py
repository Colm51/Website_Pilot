from pathlib import Path
import duckdb

# INPUT PARQUET FILE
input_file = Path(
    "...Ontario_Quebec_Manitoba_commuting.parquet"
)

# OUTPUT PARQUET FILE
output_file = Path(
    "...Ontario_Quebec_Manitoba_commuting_nonzero.parquet"
)

# COLUMN TO FILTER
gender_col = 'Gender (3):Total - Gender[1]'

con = duckdb.connect()

# ORIGINAL ROW COUNT
original_rows = con.execute(f"""
    SELECT COUNT(*)
    FROM read_parquet('{input_file}')
""").fetchone()[0]

# FILTER OUT ZERO COMMUTERS AND EXPORT
con.execute(f"""
    COPY (
        SELECT *
        FROM read_parquet('{input_file}')
        WHERE TRY_CAST("{gender_col}" AS DOUBLE) > 0
    )
    TO '{output_file}'
    (FORMAT PARQUET)
""")

# FILTERED ROW COUNT
filtered_rows = con.execute(f"""
    SELECT COUNT(*)
    FROM read_parquet('{output_file}')
""").fetchone()[0]

con.close()

print("Original rows:", original_rows)
print("Filtered rows:", filtered_rows)
print("Rows removed:", original_rows - filtered_rows)
print()
print("Saved:")
print(output_file)