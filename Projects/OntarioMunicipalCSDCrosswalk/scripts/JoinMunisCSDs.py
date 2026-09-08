import geopandas as gpd
import pandas as pd
from pathlib import Path

# ------------------------------------------------------------
# Files
# ------------------------------------------------------------

#add real filepaths

municipal_file = (
    "..."
    "Municipal_Boundary_Clipped.geojson"
)

csd_file = (
    "..."
    "OntarioCSDs.geojson"
)

output_layer = (
    "..."
    "Municipal_Boundary_With_CSD.geojson"
)

output_excel = (
    "..."
    "Municipal_CSD_Crosswalk.xlsx"
)

# ------------------------------------------------------------
# Read data
# ------------------------------------------------------------

municipal = gpd.read_file(municipal_file)
csd = gpd.read_file(csd_file)

# Make sure the two layers use the same CRS
csd = csd.to_crs(municipal.crs)

# ------------------------------------------------------------
# Create one point inside each municipality
# ------------------------------------------------------------

municipal_points = municipal.copy()
municipal_points["geometry"] = municipal.geometry.representative_point()

# ------------------------------------------------------------
# Match each municipal point to the CSD containing it
# ------------------------------------------------------------

matched = gpd.sjoin(
    municipal_points,
    csd[["CSDUID", "CSDNAME", "geometry"]],
    how="left",
    predicate="within"
)

# Remove the spatial-join helper field
matched = matched.drop(columns=["index_right"], errors="ignore")

# ------------------------------------------------------------
# Check that the join did not create duplicate municipality rows
# ------------------------------------------------------------

if len(matched) != len(municipal):
    raise ValueError(
        f"Spatial join produced {len(matched)} rows from "
        f"{len(municipal)} municipalities. "
        "Some municipal points may be matching more than one CSD."
    )

# ------------------------------------------------------------
# Add CSD fields back onto the municipal polygons
# ------------------------------------------------------------

municipal_with_csd = municipal.copy()

municipal_with_csd["CSDUID"] = matched["CSDUID"].values
municipal_with_csd["CSDNAME"] = matched["CSDNAME"].values

# ------------------------------------------------------------
# Save new municipal boundary layer
# ------------------------------------------------------------

Path(output_layer).unlink(missing_ok=True)

municipal_with_csd.to_file(
    output_layer,
    driver="GeoJSON"
)

# ------------------------------------------------------------
# Create crosswalk spreadsheet
# ------------------------------------------------------------

crosswalk = municipal_with_csd[
    [
        "MUNICIPAL_TYPE",
        "MUNICIPAL_NAME",
        "ASSESSMENT_CODE",
        "MUNICIPAL_NAME_SHORTFORM",
        "CSDUID",
        "CSDNAME"
    ]
].copy()

crosswalk = crosswalk.sort_values(
    ["MUNICIPAL_NAME"],
    na_position="last"
)

# Find CSDs that were not matched to any municipality
matched_csd_uids = set(
    crosswalk["CSDUID"].dropna().astype(str)
)

unmatched_csds = (
    csd.loc[
        ~csd["CSDUID"].astype(str).isin(matched_csd_uids),
        ["CSDUID", "CSDNAME"]
    ]
    .drop_duplicates()
    .sort_values("CSDNAME")
)

# ------------------------------------------------------------
# Write Excel workbook
# ------------------------------------------------------------

with pd.ExcelWriter(output_excel, engine="openpyxl") as writer:

    crosswalk.to_excel(
        writer,
        sheet_name="Municipal CSD Crosswalk",
        index=False
    )

    unmatched_csds.to_excel(
        writer,
        sheet_name="Unmatched CSDs",
        index=False
    )

    # Autofit columns
    for sheet in writer.book.worksheets:
        for column_cells in sheet.columns:
            max_length = max(
                len(str(cell.value)) if cell.value is not None else 0
                for cell in column_cells
            )

            sheet.column_dimensions[
                column_cells[0].column_letter
            ].width = min(max_length + 2, 50)

# ------------------------------------------------------------
# Final checks
# ------------------------------------------------------------

print("Municipalities:", len(municipal))
print("Municipalities with CSD match:", crosswalk["CSDUID"].notna().sum())
print("Municipalities without CSD match:", crosswalk["CSDUID"].isna().sum())
print("CSDs not matched to a municipality:", len(unmatched_csds))

print()
print("Created:")
print(output_layer)
print(output_excel)