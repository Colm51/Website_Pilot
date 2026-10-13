import geopandas as gpd
from pathlib import Path
from shapely.ops import polygonize, unary_union


# ============================================================
# FILES
# ============================================================

output_folder = Path(
    "/Users/aidancarter/Desktop/CodexSandbox/VancouverDAs"
)

output_folder.mkdir(
    parents=True,
    exist_ok=True
)

vancouver_boundary_file = Path(
    "/Users/aidancarter/Desktop/Master/Mapping/Vancouver/"
    "MunicipalBoundaries/city-boundary.shp"
)

canada_da_file = Path(
    "/Users/aidancarter/Desktop/CodexSandbox/TorontoVoting/"
    "StatsCan/DAs/lda_000a21a_e.shp"
)

output_gpkg = (
    output_folder
    / "Vancouver_DAs.gpkg"
)

output_parquet = (
    output_folder
    / "Vancouver_DAs.parquet"
)

output_boundary_gpkg = (
    output_folder
    / "Vancouver_boundary_polygon.gpkg"
)


# ============================================================
# 1. READ DATA
# ============================================================

print("Reading Vancouver boundary...")
vancouver_lines = gpd.read_file(
    vancouver_boundary_file
)

print("Reading Canada DAs...")
das = gpd.read_file(
    canada_da_file
)

print("\nVancouver geometry:")
print(vancouver_lines.geom_type.value_counts())

print("\nCanada DAs:", len(das))


# ============================================================
# 2. CONVERT VANCOUVER LINE TO POLYGON
# ============================================================

print("\nCreating Vancouver polygon from boundary line...")

merged_lines = unary_union(
    vancouver_lines.geometry
)

polygons = list(
    polygonize(
        merged_lines
    )
)

if len(polygons) == 0:
    raise ValueError(
        "Could not create a polygon from the Vancouver boundary line."
    )

print(
    "Polygons created:",
    len(polygons)
)

# If polygonize creates more than one polygon,
# combine them into one Vancouver geometry.

vancouver_polygon_geom = unary_union(
    polygons
)

vancouver = gpd.GeoDataFrame(
    {
        "Name": ["Vancouver"]
    },
    geometry=[
        vancouver_polygon_geom
    ],
    crs=vancouver_lines.crs
)

print(
    "Vancouver polygon geometry type:",
    vancouver.geometry.iloc[0].geom_type
)


# ============================================================
# 3. SAVE VANCOUVER POLYGON FOR QGIS
# ============================================================

vancouver.to_file(
    output_boundary_gpkg,
    layer="Vancouver_boundary",
    driver="GPKG"
)

print("\nSaved Vancouver polygon:")
print(output_boundary_gpkg)


# ============================================================
# 4. REPROJECT VANCOUVER TO DA CRS
# ============================================================

vancouver = vancouver.to_crs(
    das.crs
)


# ============================================================
# 5. CREATE REPRESENTATIVE POINTS FOR DAS
# ============================================================

print("\nCreating DA representative points...")

da_points = das[
    [
        "DAUID",
        "geometry"
    ]
].copy()

da_points["geometry"] = (
    da_points.geometry
    .representative_point()
)


# ============================================================
# 6. SELECT DAS INSIDE VANCOUVER
# ============================================================

print("Selecting Vancouver DAs...")

selected_points = gpd.sjoin(
    da_points,
    vancouver[
        ["geometry"]
    ],
    how="inner",
    predicate="within"
)

selected_indices = (
    selected_points.index
    .unique()
)

vancouver_das = (
    das.loc[
        selected_indices
    ]
    .copy()
)


# ============================================================
# 7. VALIDATION
# ============================================================

print("\n====================================")
print("VALIDATION")
print("====================================")

print(
    "Canada DAs:",
    len(das)
)

print(
    "Vancouver DAs selected:",
    len(vancouver_das)
)

print(
    "Unique DAUIDs:",
    vancouver_das["DAUID"].nunique()
)

print(
    "Duplicate DAUIDs:",
    vancouver_das["DAUID"].duplicated().sum()
)


# ============================================================
# 8. SAVE VANCOUVER DAS
# ============================================================

vancouver_das.to_file(
    output_gpkg,
    layer="Vancouver_DAs",
    driver="GPKG"
)

vancouver_das.to_parquet(
    output_parquet,
    index=False
)

print("\nSaved GeoPackage:")
print(output_gpkg)

print("\nSaved GeoParquet:")
print(output_parquet)

print("\nFinished.")