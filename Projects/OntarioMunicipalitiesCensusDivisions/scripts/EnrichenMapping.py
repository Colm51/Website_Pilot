import geopandas as gpd
import pandas as pd

gpkg_file = (
    "...ontario_municipal_boundaries_land_clipped.gpkg"
)

data_file = (
    "...municipalities_data_2021_with_separated.xlsx"
)

output_file = (
    "...ontario_municipal_boundaries_enriched.gpkg"
)

# --------------------------------------------------
# Read source files
# --------------------------------------------------

gdf = gpd.read_file(gpkg_file)

data = pd.read_excel(
    data_file,
    dtype={
        "ASSESSMENT_CODE": str,
        "UT_NUMBER": str,
        "UT_ID": str
    }
)

print("GeoPackage features:", len(gdf))
print("Municipal data rows:", len(data))

# --------------------------------------------------
# Standardize municipality IDs
# --------------------------------------------------

gdf["ASSESSMENT"] = (
    gdf["ASSESSMENT"]
    .astype(str)
    .str.strip()
    .str.zfill(4)
)

data["ASSESSMENT_CODE"] = (
    data["ASSESSMENT_CODE"]
    .astype(str)
    .str.strip()
    .str.zfill(4)
)

data["UT_ID"] = (
    data["UT_ID"]
    .astype(str)
    .str.strip()
    .str.zfill(4)
)

# --------------------------------------------------
# Validate IDs before joining
# --------------------------------------------------

gpkg_duplicates = gdf[
    gdf.duplicated(
        subset="ASSESSMENT",
        keep=False
    )
]

if len(gpkg_duplicates) > 0:
    print()
    print("ERROR: Duplicate ASSESSMENT values in GeoPackage:")
    print(
        gpkg_duplicates[
            [
                "ASSESSMENT",
                "MUNICIPALITY",
                "TIER"
            ]
        ].to_string(index=False)
    )

    raise ValueError(
        "ASSESSMENT is not unique in the GeoPackage."
    )

data_duplicates = data[
    data.duplicated(
        subset="ASSESSMENT_CODE",
        keep=False
    )
]

if len(data_duplicates) > 0:
    print()
    print("ERROR: Duplicate ASSESSMENT_CODE values in municipal data:")
    print(
        data_duplicates.to_string(index=False)
    )

    raise ValueError(
        "ASSESSMENT_CODE is not unique in the municipal dataset."
    )

# --------------------------------------------------
# Join municipal data to geometry
# --------------------------------------------------

result = gdf.merge(
    data,
    left_on="ASSESSMENT",
    right_on="ASSESSMENT_CODE",
    how="left"
)

# Remove duplicate join key from Excel
result = result.drop(
    columns=["ASSESSMENT_CODE"]
)

# --------------------------------------------------
# Validation
# --------------------------------------------------

print()
print("Features after join:", len(result))

unmatched = result[
    result["MUNICIPALITY_DESC"].isna()
]

print("Unmatched municipal geometries:", len(unmatched))

if len(unmatched) > 0:
    print()
    print("UNMATCHED MUNICIPALITIES:")
    print(
        unmatched[
            [
                "ASSESSMENT",
                "MUNICIPALITY",
                "TIER"
            ]
        ].to_string(index=False)
    )

# Confirm separated municipality count
print()
print(
    "Separated municipalities:",
    result["Separated"].fillna(0).sum()
)

# --------------------------------------------------
# Remove duplicate descriptive fields
# --------------------------------------------------

# The GeoPackage already contains MUNICIPALITY and TIER,
# so the FIR versions are not needed in the final spatial layer.

result = result.drop(
    columns=[
        "MUNICIPALITY_DESC",
        "TIER_CODE"
    ]
)

# --------------------------------------------------
# Reorder final fields
# --------------------------------------------------

result = result[
    [
        "ASSESSMENT",
        "MUNICIPALITY",
        "TIER",
        "UT_NUMBER",
        "UT_ID",
        "UT_Name",
        "Separated",
        "Geographic_County",
        "geometry"
    ]
]

# --------------------------------------------------
# Save new GeoPackage
# --------------------------------------------------

result.to_file(
    output_file,
    layer="municipal_boundaries",
    driver="GPKG"
)

print()
print("Saved to:")
print(output_file)

print()
print("Final fields:")
print(result.columns.tolist())