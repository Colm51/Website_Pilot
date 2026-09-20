import geopandas as gpd
from pathlib import Path

# INPUT FILE
input_file = Path(
    "...lcsd000a25p_e.gpkg"
)

# OUTPUT FILE
output_file = Path(
    "...ON_QC_MB_CSDs.gpkg"
)

# READ CSD BOUNDARIES
gdf = gpd.read_file(input_file)

print("Columns:")
print(gdf.columns.tolist())

# KEEP QUEBEC, ONTARIO, AND MANITOBA
province_codes = ["24", "35", "46"]

selected = gdf[
    gdf["PRUID"].astype(str).isin(province_codes)
].copy()

# ADD PROVINCE NAME
province_names = {
    "24": "Quebec",
    "35": "Ontario",
    "46": "Manitoba"
}

selected["Province"] = (
    selected["PRUID"]
    .astype(str)
    .map(province_names)
)

# KEEP ORIGINAL CRS
print()
print("CRS:", selected.crs)

# EXPORT
selected.to_file(
    output_file,
    driver="GPKG"
)

print()
print("CSDs by province:")
print(selected["Province"].value_counts())

print()
print(f"Saved {len(selected):,} CSDs")
print(output_file)