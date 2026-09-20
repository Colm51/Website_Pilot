from pathlib import Path
from datetime import datetime
import pandas as pd

# --------------------------------
# DATA FOLDER
# --------------------------------
data_folder = Path(
    "...Data"
)

# --------------------------------
# FIND MOST RECENT SPLIT FILE
# --------------------------------
split_files = list(
    data_folder.glob(
        "Ontario_Quebec_Manitoba_commuting_nonzero_split_*.parquet"
    )
)

if not split_files:
    raise FileNotFoundError(
        "No split commuting Parquet file was found."
    )

input_file = max(split_files, key=lambda p: p.stat().st_mtime)

print("Input file:")
print(input_file)

# --------------------------------
# READ DATA
# --------------------------------
df = pd.read_parquet(input_file)

print()
print("Rows:", len(df))

# --------------------------------
# VALIDATE HOME COORDINATE -> DGUID
# --------------------------------
coordinate_check = (
    df.groupby("Home_Coordinate")["DGUID"]
    .nunique()
)

conflicts = coordinate_check[
    coordinate_check > 1
]

if len(conflicts) > 0:
    print()
    print("ERROR: Some Home_Coordinates map to multiple DGUIDs:")
    print(conflicts)
    raise ValueError(
        "Home_Coordinate -> DGUID lookup is not unique."
    )

print()
print("Home_Coordinate -> DGUID lookup is unique.")

# --------------------------------
# CREATE HOME COORDINATE -> DGUID LOOKUP
# --------------------------------
coordinate_to_dguid = (
    df[
        ["Home_Coordinate", "DGUID"]
    ]
    .drop_duplicates()
    .set_index("Home_Coordinate")["DGUID"]
)

print("Unique coordinate/DGUID matches:", len(coordinate_to_dguid))

# --------------------------------
# MATCH WORK COORDINATES TO DGUID
# --------------------------------
df["Work_DGUID"] = (
    df["Work_Coordinate"]
    .map(coordinate_to_dguid)
)

# --------------------------------
# VALIDATE MATCHING
# --------------------------------
matched = df["Work_DGUID"].notna().sum()
unmatched = df["Work_DGUID"].isna().sum()

print()
print("Work DGUIDs matched:", matched)
print("Work DGUIDs not matched:", unmatched)

# --------------------------------
# OUTPUT FILE
# --------------------------------
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

output_file = data_folder / (
    f"Ontario_Quebec_Manitoba_commuting_Work_DGUID_{timestamp}.parquet"
)

df.to_parquet(
    output_file,
    index=False
)

# --------------------------------
# SAMPLE RESULTS
# --------------------------------
print()
print(
    df[
        [
            "DGUID",
            "Home_Coordinate",
            "Work_Coordinate",
            "Work_DGUID"
        ]
    ]
    .head(20)
    .to_string(index=False)
)

print()
print("Saved:")
print(output_file)