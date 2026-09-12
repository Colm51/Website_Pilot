import geopandas as gpd

# --------------------------------------------------
# File paths
# --------------------------------------------------

municipal_file = (
    "...ontario_municipal_boundaries_all.gpkg"
)

ontario_land_file = (
    "...Ontario_Province.gpkg"
)

output_file = (
    "...Ontario_municipal_boundaries_land_clipped.gpkg"
)

# --------------------------------------------------
# Read data
# --------------------------------------------------

municipal = gpd.read_file(municipal_file)
ontario_land = gpd.read_file(ontario_land_file)

print("SOURCE DATA")
print("Municipal CRS:", municipal.crs)
print("Ontario land CRS:", ontario_land.crs)
print("Municipal features:", len(municipal))
print("Ontario land features:", len(ontario_land))

# --------------------------------------------------
# Validate municipal source
# --------------------------------------------------

if len(municipal) != 444:
    raise ValueError(
        f"Expected 444 municipalities, found {len(municipal)}."
    )

duplicates = municipal[
    municipal.duplicated(
        subset="ASSESSMENT",
        keep=False
    )
]

if len(duplicates) > 0:
    print("\nERROR: Duplicate ASSESSMENT values:")
    print(
        duplicates[
            [
                "ASSESSMENT",
                "MUNICIPALITY",
                "TIER"
            ]
        ].to_string(index=False)
    )

    raise ValueError("ASSESSMENT is not unique.")

print("Validation passed: 444 unique municipalities.")

# --------------------------------------------------
# Match CRS
# --------------------------------------------------

if ontario_land.crs != municipal.crs:
    print("\nCRS values differ.")
    print("Reprojecting Ontario land boundary to municipal CRS.")

    ontario_land = ontario_land.to_crs(
        municipal.crs
    )

# --------------------------------------------------
# Create one Ontario land clipping geometry
# --------------------------------------------------

ontario_mask = ontario_land.dissolve()

# --------------------------------------------------
# Clip municipalities to Ontario land
# --------------------------------------------------

clipped = gpd.clip(
    municipal,
    ontario_mask
)

# --------------------------------------------------
# Keep final fields
# --------------------------------------------------

clipped = clipped[
    [
        "ASSESSMENT",
        "MUNICIPALITY",
        "TIER",
        "geometry"
    ]
].copy()

clipped = clipped.sort_values(
    [
        "ASSESSMENT",
        "TIER",
        "MUNICIPALITY"
    ]
).reset_index(drop=True)

# --------------------------------------------------
# Validation
# --------------------------------------------------

print()
print("CLIPPING RESULTS")
print("Original municipal features:", len(municipal))
print("Clipped municipal features:", len(clipped))

empty_geom = clipped.geometry.is_empty.sum()
invalid_geom = (~clipped.geometry.is_valid).sum()

print("Empty geometries:", empty_geom)
print("Invalid geometries:", invalid_geom)

if len(clipped) != 444:
    raise ValueError(
        f"Expected 444 municipalities after clipping, "
        f"found {len(clipped)}."
    )

if empty_geom > 0:
    raise ValueError(
        f"{empty_geom} empty geometries found after clipping."
    )

if invalid_geom > 0:
    raise ValueError(
        f"{invalid_geom} invalid geometries found after clipping."
    )

print()
print("Validation passed: all 444 municipalities survived clipping.")

# --------------------------------------------------
# Save
# --------------------------------------------------

clipped.to_file(
    output_file,
    layer="municipal_boundaries_land_clipped",
    driver="GPKG"
)

print()
print("Saved to:")
print(output_file)