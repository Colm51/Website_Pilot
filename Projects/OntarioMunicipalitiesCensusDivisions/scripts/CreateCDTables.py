import geopandas as gpd
import pandas as pd
from pathlib import Path

# --------------------------------------------------
# File paths
# --------------------------------------------------

municipal_file = (
    "...ontario_municipal_boundaries_enriched.gpkg"
)

cd_file = (
    "...ontario_census_divisions.gpkg"
)

output_dir = Path(
    "...Project"
)

municipality_output = output_dir / "CD_municipality_crosswalk.xlsx"
cd_output = output_dir / "CD_summary.xlsx"

# --------------------------------------------------
# Read source files
# --------------------------------------------------

mun = gpd.read_file(municipal_file)
cd = gpd.read_file(cd_file)

print("SOURCE DATA")
print("Municipalities:", len(mun))
print("Census divisions:", len(cd))
print("Municipal CRS:", mun.crs)
print("CD CRS:", cd.crs)

# --------------------------------------------------
# Reproject for area calculations
# --------------------------------------------------

mun = mun.to_crs(3347)
cd = cd.to_crs(3347)

# --------------------------------------------------
# Keep required CD fields
# --------------------------------------------------
t/
cd_small = cd[
    [
        "CDUID",
        "CDNAME",
        "CDTYPE",
        "geometry"
    ]
].copy()

# --------------------------------------------------
# Calculate municipality-CD intersections
# --------------------------------------------------

intersections = gpd.overlay(
    mun,
    cd_small,
    how="intersection"
)

intersections["overlap_area"] = intersections.geometry.area

# --------------------------------------------------
# Calculate municipality total area
# --------------------------------------------------

municipal_area = (
    mun
    .set_index("ASSESSMENT")
    .geometry.area
    .rename("municipal_area")
)

# --------------------------------------------------
# Sum overlap by municipality and CD
# --------------------------------------------------

overlap = (
    intersections
    .groupby(
        [
            "ASSESSMENT",
            "CDUID",
            "CDNAME",
            "CDTYPE"
        ],
        as_index=False
    )["overlap_area"]
    .sum()
)

overlap = overlap.merge(
    municipal_area,
    on="ASSESSMENT",
    how="left"
)

overlap["overlap_percent"] = (
    overlap["overlap_area"]
    / overlap["municipal_area"]
    * 100
)

# --------------------------------------------------
# Select best CD match for each municipality
# --------------------------------------------------

best = (
    overlap
    .sort_values(
        [
            "ASSESSMENT",
            "overlap_area"
        ],
        ascending=[
            True,
            False
        ]
    )
    .drop_duplicates(
        subset="ASSESSMENT",
        keep="first"
    )
)

# --------------------------------------------------
# Build municipality-level table
# --------------------------------------------------

municipality_table = best[
    [
        "ASSESSMENT",
        "CDUID",
        "CDNAME",
        "CDTYPE",
        "overlap_percent"
    ]
].copy()

municipality_table = municipality_table.merge(
    mun[
        [
            "ASSESSMENT",
            "MUNICIPALITY",
            "TIER",
            "UT_ID",
            "UT_Name",
            "Separated"
        ]
    ],
    on="ASSESSMENT",
    how="left"
)

municipality_table = municipality_table[
    [
        "CDUID",
        "CDNAME",
        "CDTYPE",
        "ASSESSMENT",
        "MUNICIPALITY",
        "TIER",
        "UT_ID",
        "UT_Name",
        "Separated",
        "overlap_percent"
    ]
].copy()

tier_order = {
    "UT": 1,
    "ST": 2,
    "LT": 3
}

municipality_table["_tier_order"] = (
    municipality_table["TIER"]
    .map(tier_order)
)

municipality_table = (
    municipality_table
    .sort_values(
        [
            "CDNAME",
            "_tier_order",
            "MUNICIPALITY"
        ]
    )
    .drop(columns="_tier_order")
    .reset_index(drop=True)
)

# --------------------------------------------------
# Build CD summary table
# --------------------------------------------------

cd_summary = (
    municipality_table
    .groupby(
        [
            "CDUID",
            "CDNAME",
            "CDTYPE"
        ],
        as_index=False
    )
    .agg(
        UT_Count=("TIER", lambda x: (x == "UT").sum()),
        ST_Count=("TIER", lambda x: (x == "ST").sum()),
        LT_Count=("TIER", lambda x: (x == "LT").sum()),
        Municipality_Count=("ASSESSMENT", "count"),
        Separated_Count=(
            "Separated",
            lambda x: int(x.fillna(0).sum())
        )
    )
)

cd_summary["Has_Separated"] = (
    cd_summary["Separated_Count"] > 0
).astype(int)

# --------------------------------------------------
# Add municipality name lists
# --------------------------------------------------

def municipality_list(df, tier):
    return (
        df[df["TIER"] == tier]
        .groupby("CDUID")["MUNICIPALITY"]
        .apply(lambda x: "; ".join(sorted(x)))
    )

ut_names = municipality_list(
    municipality_table,
    "UT"
)

st_names = municipality_list(
    municipality_table,
    "ST"
)

lt_names = municipality_list(
    municipality_table,
    "LT"
)

separated_names = (
    municipality_table[
        municipality_table["Separated"]
        .fillna(0) == 1
    ]
    .groupby("CDUID")["MUNICIPALITY"]
    .apply(lambda x: "; ".join(sorted(x)))
)

cd_summary["UT_Municipalities"] = (
    cd_summary["CDUID"]
    .map(ut_names)
    .fillna("")
)

cd_summary["ST_Municipalities"] = (
    cd_summary["CDUID"]
    .map(st_names)
    .fillna("")
)

cd_summary["LT_Municipalities"] = (
    cd_summary["CDUID"]
    .map(lt_names)
    .fillna("")
)

cd_summary["Separated_Municipalities"] = (
    cd_summary["CDUID"]
    .map(separated_names)
    .fillna("")
)

cd_summary = cd_summary.sort_values(
    "CDNAME"
).reset_index(drop=True)

# --------------------------------------------------
# Validation
# --------------------------------------------------

print()
print("VALIDATION")

print("Municipality table rows:", len(municipality_table))
print(
    "Unique municipalities:",
    municipality_table["ASSESSMENT"].nunique()
)
print(
    "Unique CDs represented:",
    municipality_table["CDUID"].nunique()
)

print()
print("Tier counts:")
print(
    municipality_table["TIER"]
    .value_counts()
    .to_string()
)

print()
print(
    "Separated municipalities:",
    int(
        municipality_table["Separated"]
        .fillna(0)
        .sum()
    )
)

print()
print("CD summary rows:", len(cd_summary))
print(
    "Unique CDs:",
    cd_summary["CDUID"].nunique()
)

print()
print("Totals from CD summary:")
print("UT:", cd_summary["UT_Count"].sum())
print("ST:", cd_summary["ST_Count"].sum())
print("LT:", cd_summary["LT_Count"].sum())
print(
    "Municipalities:",
    cd_summary["Municipality_Count"].sum()
)
print(
    "Separated:",
    cd_summary["Separated_Count"].sum()
)

print()
print("Lowest overlap percentages:")
print(
    municipality_table[
        [
            "ASSESSMENT",
            "MUNICIPALITY",
            "CDNAME",
            "overlap_percent"
        ]
    ]
    .sort_values("overlap_percent")
    .head(20)
    .to_string(index=False)
)

# --------------------------------------------------
# Stop if validation fails
# --------------------------------------------------

if len(municipality_table) != 444:
    raise ValueError("Expected 444 municipality rows.")

if municipality_table["ASSESSMENT"].nunique() != 444:
    raise ValueError("Expected 444 unique municipalities.")

if municipality_table["CDUID"].nunique() != 49:
    raise ValueError("Expected all 49 Census Divisions.")

if len(cd_summary) != 49:
    raise ValueError("Expected 49 CD summary rows.")

if cd_summary["Municipality_Count"].sum() != 444:
    raise ValueError("CD summary municipality total does not equal 444.")

if cd_summary["Separated_Count"].sum() != 19:
    raise ValueError("Expected 19 separated municipalities.")

# --------------------------------------------------
# Save Excel files
# --------------------------------------------------

municipality_table.to_excel(
    municipality_output,
    index=False
)

cd_summary.to_excel(
    cd_output,
    index=False
)

print()
print("SAVED")
print(municipality_output)
print(cd_output)