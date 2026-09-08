import geopandas as gpd

#add real filepaths

input_file = ".../lcsd000a25p_e.gpkg"
output_file = ".../OntarioCSDs.geojson"

# Read the CSD GeoPackage
gdf = gpd.read_file(input_file)

# Check the available columns
print(gdf.columns.tolist())

# Keep only Ontario CSDs
ontario = gdf[gdf["PRUID"].astype(str) == "35"].copy()

# Convert to WGS84 for Leaflet
ontario = ontario.to_crs("EPSG:4326")

# Export to GeoJSON
ontario.to_file(output_file, driver="GeoJSON")

print(f"Saved {len(ontario):,} Ontario CSDs")
print(output_file)