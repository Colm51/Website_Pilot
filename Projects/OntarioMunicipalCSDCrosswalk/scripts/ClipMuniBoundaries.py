import geopandas as gpd
from pathlib import Path

#add real filepaths

municipal_file = ".../Municipal_Boundary_Clean.geojson"
ontario_file = ".../Ontario_Province.gpkg"
output_file = ".../StatsCan/Municipal_Boundary_Clipped.geojson"

municipal = gpd.read_file(municipal_file)
ontario = gpd.read_file(ontario_file)

# Make sure both layers use the same coordinate system
ontario = ontario.to_crs(municipal.crs)

# Clip municipalities to the Ontario cartographic boundary
clipped = gpd.clip(municipal, ontario)

# Save the result
Path(output_file).unlink(missing_ok=True)

clipped.to_file(
    output_file,
    driver="GeoJSON"
)

print("Original municipalities:", len(municipal))
print("Clipped municipalities:", len(clipped))
print("CRS:", clipped.crs)
print("Saved:", output_file)