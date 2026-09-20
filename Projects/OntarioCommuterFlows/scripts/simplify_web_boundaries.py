from pathlib import Path
import geopandas as gpd

# --------------------------------------------------
# INPUT FOLDER
# --------------------------------------------------

website_data = Path(
    "...WebsiteData"
)

# --------------------------------------------------
# INPUT FILES
# --------------------------------------------------

csd_file = website_data / "csd_boundaries.geojson"

municipal_file = (
    website_data / "ontario_municipal_boundaries.geojson"
)

# --------------------------------------------------
# SIMPLIFICATION TOLERANCES IN METRES
# --------------------------------------------------

tolerances = [100, 250]

# --------------------------------------------------
# FUNCTION TO SIMPLIFY ONE FILE
# --------------------------------------------------

def simplify_geojson(input_file, output_stem):
    print()
    print("Reading:")
    print(input_file)

    gdf = gpd.read_file(input_file)

    print("Rows:", len(gdf))
    print("Original CRS:", gdf.crs)

    # Project to Statistics Canada Lambert
    # so simplification tolerance is measured in metres
    projected = gdf.to_crs("EPSG:3347")

    for tolerance in tolerances:

        simplified = projected.copy()

        simplified["geometry"] = (
            simplified.geometry.simplify(
                tolerance=tolerance,
                preserve_topology=True
            )
        )

        # Convert back to WGS84 for web mapping
        simplified = simplified.to_crs("EPSG:4326")

        output_file = website_data / (
            f"{output_stem}_{tolerance}m.geojson"
        )

        simplified.to_file(
            output_file,
            driver="GeoJSON"
        )

        size_mb = output_file.stat().st_size / (1024 * 1024)

        print()
        print(f"Tolerance: {tolerance} metres")
        print(f"Saved: {output_file}")
        print(f"File size: {size_mb:.1f} MB")


# --------------------------------------------------
# SIMPLIFY CSD BOUNDARIES
# --------------------------------------------------

simplify_geojson(
    csd_file,
    "csd_boundaries"
)

# --------------------------------------------------
# SIMPLIFY ONTARIO MUNICIPAL BOUNDARIES
# --------------------------------------------------

simplify_geojson(
    municipal_file,
    "ontario_municipal_boundaries"
)

print()
print("Finished.")