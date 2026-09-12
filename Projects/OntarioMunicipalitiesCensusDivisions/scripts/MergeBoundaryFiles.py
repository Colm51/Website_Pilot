import geopandas as gpd
import pandas as pd

# --------------------------------------------------
# File paths
# --------------------------------------------------

upper_file = (
    "...MUNIC_BND_UPPER_AND_DIST.shp"
)

lower_single_file = (
    "...MUNIC_BND_LOWER_AND_SINGLE.shp"
)

output_file = (
    "...ontario_municipal_boundaries_all.gpkg"
)

# --------------------------------------------------
# Read source files
# --------------------------------------------------

upper = gpd.read_file(upper_file)
lower_single = gpd.read_file(lower_single_file)

print("SOURCE FILES")
print("Upper-tier/district rows:", len(upper))
print("Lower/single-tier rows:", len(lower_single))
print("Upper CRS:", upper.crs)
print("Lower/single CRS:", lower_single.crs)

# --------------------------------------------------
# Confirm / standardize CRS
# --------------------------------------------------

if upper.crs != lower_single.crs:
    print("\nCRS values differ. Reprojecting lower/single-tier layer.")
    lower_single = lower_single.to_crs(upper.crs)

# --------------------------------------------------
# Standardize assessment codes
# --------------------------------------------------

upper["ASSESS_C"] = (
    upper["ASSESS_C"]
    .astype(str)
    .str.strip()
    .str.zfill(4)
)

lower_single["ASSESS_C"] = (
    lower_single["ASSESS_C"]
    .astype(str)
    .str.strip()
    .str.zfill(4)
)

# --------------------------------------------------
# Clean upper-tier layer
# --------------------------------------------------

# Keep actual upper-tier municipalities only.
# Exclude geographic districts.
upper_clean = upper[
    upper["MUN_TYPE_E"] == "Upper Tier Municipality"
].copy()

upper_clean = upper_clean[
    [
        "ASSESS_C",
        "NAME_E",
        "geometry"
    ]
].copy()

upper_clean = upper_clean.rename(
    columns={
        "ASSESS_C": "ASSESSMENT",
        "NAME_E": "MUNICIPALITY"
    }
)

upper_clean["TIER"] = "UT"

# Dissolve mainland / islands / water pieces
# into one feature per municipality
upper_clean = upper_clean.dissolve(
    by=[
        "ASSESSMENT",
        "MUNICIPALITY",
        "TIER"
    ],
    as_index=False
)

# --------------------------------------------------
# Clean lower/single-tier layer
# --------------------------------------------------

lower_clean = lower_single[
    lower_single["MUN_TYPE_E"].isin(
        [
            "Lower Tier Municipality",
            "Single Tier Municipality"
        ]
    )
].copy()

lower_clean = lower_clean[
    [
        "ASSESS_C",
        "NAME_E",
        "MUN_TYPE_E",
        "geometry"
    ]
].copy()

lower_clean = lower_clean.rename(
    columns={
        "ASSESS_C": "ASSESSMENT",
        "NAME_E": "MUNICIPALITY"
    }
)

tier_map = {
    "Lower Tier Municipality": "LT",
    "Single Tier Municipality": "ST"
}

lower_clean["TIER"] = lower_clean["MUN_TYPE_E"].map(tier_map)

# Check for unexpected municipality types
unexpected_types = lower_clean.loc[
    lower_clean["TIER"].isna(),
    "MUN_TYPE_E"
].dropna().unique()

if len(unexpected_types) > 0:
    print("\nWARNING: Unexpected MUN_TYPE_E values found:")
    print(unexpected_types)

lower_clean = lower_clean[
    [
        "ASSESSMENT",
        "MUNICIPALITY",
        "TIER",
        "geometry"
    ]
]

# Dissolve mainland / islands / water pieces
# into one feature per municipality
lower_clean = lower_clean.dissolve(
    by=[
        "ASSESSMENT",
        "MUNICIPALITY",
        "TIER"
    ],
    as_index=False
)

# --------------------------------------------------
# Combine UT + LT + ST
# --------------------------------------------------

combined = gpd.GeoDataFrame(
    pd.concat(
        [
            upper_clean,
            lower_clean
        ],
        ignore_index=True
    ),
    geometry="geometry",
    crs=upper.crs
)

combined = combined.sort_values(
    [
        "ASSESSMENT",
        "TIER",
        "MUNICIPALITY"
    ]
).reset_index(drop=True)

# --------------------------------------------------
# Validation
# --------------------------------------------------

print("\nCLEANED COUNTS")
print("Upper tiers:", len(upper_clean))
print("Lower tiers:", (lower_clean["TIER"] == "LT").sum())
print("Single tiers:", (lower_clean["TIER"] == "ST").sum())
print("Combined:", len(combined))

print("\nTIER COUNTS")
print(combined["TIER"].value_counts())

# Check unique municipality IDs
duplicates = combined[
    combined.duplicated(
        subset="ASSESSMENT",
        keep=False
    )
]

if len(duplicates) == 0:
    print("\nValidation passed: ASSESSMENT is unique.")
else:
    print("\nERROR: Duplicate ASSESSMENT values found:")
    print(
        duplicates[
            [
                "ASSESSMENT",
                "MUNICIPALITY",
                "TIER"
            ]
        ].to_string(index=False)
    )

    raise ValueError("ASSESSMENT is not unique.")

# Check missing core fields
missing = combined[
    combined["ASSESSMENT"].isna()
    | combined["MUNICIPALITY"].isna()
    | combined["TIER"].isna()
]

if len(missing) == 0:
    print("Validation passed: no missing core fields.")
else:
    print("\nERROR: Missing core fields found:")
    print(missing.to_string(index=False))

    raise ValueError("Missing core fields.")

# Validate expected Ontario municipality counts
tier_counts = combined["TIER"].value_counts()

expected_counts = {
    "UT": 30,
    "LT": 241,
    "ST": 173
}

print("\nEXPECTED COUNT CHECK")

for tier, expected in expected_counts.items():
    actual = tier_counts.get(tier, 0)

    print(f"{tier}: {actual} (expected {expected})")

    if actual != expected:
        raise ValueError(
            f"Unexpected {tier} count: "
            f"{actual}; expected {expected}."
        )

if len(combined) != 444:
    raise ValueError(
        f"Unexpected combined count: "
        f"{len(combined)}; expected 444."
    )

print("\nValidation passed: 444 total municipal records.")

# --------------------------------------------------
# Save final GeoPackage
# --------------------------------------------------

combined.to_file(
    output_file,
    layer="municipal_boundaries",
    driver="GPKG"
)

print("\nFINAL FILE")
print(output_file)

print("\nFINAL FIELDS")
print(combined.columns.tolist())