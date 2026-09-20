from pathlib import Path
import pandas as pd

# INPUT FILE
input_file = Path(
    "...98100459.csv"
)

# OUTPUT FOLDER
out_folder = Path(
    "...Data"
)


out_folder.mkdir(parents=True, exist_ok=True)

# READ DATA
# Keep Coordinate as text so values such as 832.8320
# are preserved exactly and do not become 832.832
df = pd.read_csv(
    input_file,
    dtype={"Coordinate": "string"}
)

# FILTER FOR QUEBEC, ONTARIO, AND MANITOBA
province_prefixes = {
    "2021A000524": "Quebec",
    "2021A000535": "Ontario",
    "2021A000546": "Manitoba"
}

selected = df[
    df["DGUID"].astype(str).str.startswith(
        tuple(province_prefixes.keys())
    )
].copy()

# ADD PROVINCE FIELD
selected["Province"] = (
    selected["DGUID"]
    .astype(str)
    .str[:11]
    .map(province_prefixes)
)

# CHECK RESULTS
print("Total rows:", len(selected))
print()
print(selected["Province"].value_counts())

# EXPORT
out_file = out_folder / "Ontario_Quebec_Manitoba_commuting.parquet"

selected.to_parquet(out_file, index=False)

print()
print(f"Saved: {out_file}")