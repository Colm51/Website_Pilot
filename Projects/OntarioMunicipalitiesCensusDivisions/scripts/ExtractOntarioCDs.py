import geopandas as gpd

input_file = (
    "...lcd_000b21a_e.shp"
)

output_file = (
    "...ontario_census_divisions.gpkg"
)

# Read national Census Division boundaries
cds = gpd.read_file(input_file)

# Ontario = PRUID 35
ontario_cds = cds[
    cds["PRUID"].astype(str).str.zfill(2) == "35"
].copy()

# Sort for easier inspection
ontario_cds = ontario_cds.sort_values("CDUID").reset_index(drop=True)

# Save Ontario only
ontario_cds.to_file(
    output_file,
    layer="ontario_census_divisions",
    driver="GPKG"
)

print("Ontario Census Divisions:", len(ontario_cds))
print("CRS:", ontario_cds.crs)
print("Fields:", ontario_cds.columns.tolist())
print("Saved to:")
print(output_file)