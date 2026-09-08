import geopandas as gpd

#add real filepaths

input_file = ".../Municipal_Boundary_-_Lower_and_Single_Tier.geojson"
output_file = ".../Municipal_Boundary_Clean.geojson"

gdf = gpd.read_file(input_file)

clean = gdf.dissolve(
    by="MUNID",
    as_index=False,
    aggfunc="first"
)

clean.to_file(output_file, driver="GeoJSON")

print("Original rows:", len(gdf))
print("Clean rows:", len(clean))
print("Saved:", output_file)