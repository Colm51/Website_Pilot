from pathlib import Path

import geopandas as gpd
import pyarrow.parquet as pq


# ============================================================
# FILES
# ============================================================

boundary_file = Path(
    "/Users/aidancarter/Desktop/CodexSandbox/VancouverDAs/"
    "Vancouver_DAs.gpkg"
)

census_file = Path(
    "/Users/aidancarter/Desktop/CodexSandbox/VancouverDAs/"
    "Vancouver_DA_Census_Profile_1_368_long.parquet"
)

output_file = Path(
    "/Users/aidancarter/Desktop/CodexSandbox/VancouverDAs/"
    "Vancouver_DAs_Census_Selected.gpkg"
)


# ============================================================
# CHARACTERISTICS TO ADD
# ============================================================

# Add or remove characteristic numbers here.
# 6 = Population density per square kilometre

characteristics_to_map = [
    6,
    40,
    42,
    47,
    113,
]


# ============================================================
# READ BOUNDARIES
# ============================================================

print("Reading Vancouver DA boundaries...")

gdf = gpd.read_file(
    boundary_file
)

print("Boundary rows:", len(gdf))
print("Boundary columns:")
print(list(gdf.columns))


# ============================================================
# FIND DAUID FIELD
# ============================================================

if "DAUID" not in gdf.columns:
    raise ValueError(
        "The boundary file does not contain a DAUID field."
    )


gdf["DAUID"] = (
    gdf["DAUID"]
    .astype(str)
    .str.strip()
)


# ============================================================
# READ LONG CENSUS DATA
# ============================================================

print("\nReading Census Profile data...")

table = pq.read_table(
    census_file,
    columns=[
        "DAUID",
        "Characteristic",
        "Characteristic_Name",
        "Value",
    ]
)

da_values = table["DAUID"].to_pylist()
char_values = table["Characteristic"].to_pylist()
name_values = table["Characteristic_Name"].to_pylist()
obs_values = table["Value"].to_pylist()


# ============================================================
# ADD EACH SELECTED CHARACTERISTIC TO THE MAP
# ============================================================

for characteristic_number in characteristics_to_map:

    value_lookup = {}
    characteristic_name = None

    for da_uid, char_num, char_name, value in zip(
        da_values,
        char_values,
        name_values,
        obs_values
    ):

        if int(char_num) != characteristic_number:
            continue

        da_uid = str(da_uid).strip()

        value_lookup[da_uid] = value

        if characteristic_name is None:
            characteristic_name = char_name


    print(
        f"\nCharacteristic {characteristic_number}:",
        characteristic_name
    )

    print(
        "Values found:",
        len(value_lookup)
    )


    # Use the characteristic number as the field name.
    # Example: characteristic 6 becomes field C6.
    field_name = f"C{characteristic_number}"


    gdf[field_name] = (
        gdf["DAUID"]
        .map(value_lookup)
    )


    matched = gdf[field_name].notna().sum()

    print(
        "Boundary DAs with a value:",
        matched
    )

    print(
        "Boundary DAs with null value:",
        len(gdf) - matched
    )


# ============================================================
# SAVE
# ============================================================

print("\nWriting GeoPackage...")

gdf.to_file(
    output_file,
    layer="Vancouver_DAs_Census",
    driver="GPKG"
)

print("\nSaved:")
print(output_file)

print("\nRows:", len(gdf))
print("CRS:", gdf.crs)

print("\nAdded fields:")

for characteristic_number in characteristics_to_map:
    print(f"C{characteristic_number}")