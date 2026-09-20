from pathlib import Path
from datetime import datetime
import duckdb

# INPUT FILE
input_file = Path(
    "...Ontario_Quebec_Manitoba_commuting_nonzero.parquet"
)

# OUTPUT FOLDER
output_folder = Path(
    "...StatsCanProcessing/Data"
)

# TIMESTAMP
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

# OUTPUT FILE
output_file = output_folder / (
    f"Ontario_Quebec_Manitoba_commuting_nonzero_split_{timestamp}.parquet"
)

con = duckdb.connect()

# SPLIT COORDINATE EXACTLY AS STORED
con.execute(f"""
    COPY (
        SELECT
            *,
            split_part("Coordinate", '.', 1) AS Home_Coordinate,
            split_part("Coordinate", '.', 2) AS Work_Coordinate
        FROM read_parquet('{input_file}')
    )
    TO '{output_file}'
    (FORMAT PARQUET)
""")

# VALIDATE RESULT
sample = con.execute(f"""
    SELECT
        Coordinate,
        Home_Coordinate,
        Work_Coordinate
    FROM read_parquet('{output_file}')
    LIMIT 20
""").df()

row_count = con.execute(f"""
    SELECT COUNT(*)
    FROM read_parquet('{output_file}')
""").fetchone()[0]

con.close()

print(sample.to_string(index=False))
print()
print("Rows:", row_count)
print("Saved:")
print(output_file)