import geopandas as gpd
from pathlib import Path

#add real filepaths

input_file = "...lpr_000b21a_e.shp"
output_file = "...Ontario_Province.gpkg"

gdf = gpd.read_file(input_file)

ontario = gdf[gdf["PRUID"].astype(str) == "35"].copy()

ontario = ontario.to_crs("EPSG:4326")

Path(output_file).unlink(missing_ok=True)

ontario.to_file(
    output_file,
    driver="GPKG"
)

print("Rows:", len(ontario))
print("CRS:", ontario.crs)
print("Saved:", output_file)