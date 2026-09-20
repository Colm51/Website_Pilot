from pathlib import Path

import duckdb
import geopandas as gpd
import pandas as pd

from shapely.geometry import (
    LineString,
    MultiPoint,
    Polygon
)

from shapely.ops import (
    nearest_points,
    unary_union
)


# ============================================================
# INPUT FILES
# ============================================================

commuting_file = Path(
    "/Users/aidancarter/Desktop/CodexSandbox/Commuting/"
    "StatsCanProcessing/Data/"
    "Ontario_Quebec_Manitoba_commuting_CSDUID_20260919_211106.parquet"
)

csd_file = Path(
    "/Users/aidancarter/Desktop/CodexSandbox/Commuting/"
    "BoundaryFiles/ON_QC_MB_CSDs.gpkg"
)

ontario_municipal_file = Path(
    "/Users/aidancarter/Desktop/CodexSandbox/Commuting/"
    "BoundaryFiles/Municipal_Boundary_With_CSD.geojson"
)


# ============================================================
# OUTPUT FOLDER
# ============================================================

output_folder = Path(
    "/Users/aidancarter/Desktop/CodexSandbox/Commuting/WebsiteData"
)

output_folder.mkdir(
    parents=True,
    exist_ok=True
)

csd_output = (
    output_folder
    / "csd_boundaries.geojson"
)

municipal_output = (
    output_folder
    / "ontario_municipal_boundaries.geojson"
)

flows_output = (
    output_folder
    / "commuter_flows.geojson"
)


# ============================================================
# FUNCTION:
# CREATE OUTER SHELL OF A POLYGON WITHOUT ITS HOLES
# ============================================================

def outer_shell_only(geometry):

    if geometry is None or geometry.is_empty:
        return geometry

    if geometry.geom_type == "Polygon":

        return Polygon(
            geometry.exterior
        )

    if geometry.geom_type == "MultiPolygon":

        shells = [
            Polygon(part.exterior)
            for part in geometry.geoms
        ]

        return unary_union(shells)

    return geometry


# ============================================================
# 1. CSD BOUNDARIES
# ============================================================

print("Reading CSD boundaries...")

csds = gpd.read_file(
    csd_file
)

csds["CSDUID"] = (
    csds["CSDUID"]
    .astype(str)
)

print(
    "CSD rows:",
    len(csds)
)

print(
    "Original CSD CRS:",
    csds.crs
)

print(
    "CSDTYPE values:"
)

print(
    sorted(
        csds["CSDTYPE"]
        .dropna()
        .astype(str)
        .unique()
    )
)


# Convert boundaries to WGS84
# for web mapping

csds_web = csds.to_crs(
    "EPSG:4326"
)

csds_web.to_file(
    csd_output,
    driver="GeoJSON"
)

print()
print("Saved CSD boundaries:")
print(csd_output)


# ============================================================
# 2. CREATE REPRESENTATIVE POINT FOR EACH CSD
# ============================================================

print()
print(
    "Creating CSD representative points..."
)


# Work in Statistics Canada Lambert
# so geometry calculations are in metres

csds_projected = csds.to_crs(
    "EPSG:3347"
)


# ------------------------------------------------------------
# Start with normal representative points for every CSD
# ------------------------------------------------------------

normal_points = (
    csds_projected.geometry
    .representative_point()
)


csd_points = csds_projected[
    [
        "CSDUID",
        "CSDTYPE",
        "geometry"
    ]
].copy()


if (
    "CSDNAME"
    in csds_projected.columns
):

    csd_points[
        "CSDNAME"
    ] = (
        csds_projected[
            "CSDNAME"
        ]
    )


csd_points[
    "geometry"
] = normal_points


# Diagnostic field used only while
# creating the points

csd_points[
    "Point_Method"
] = (
    "representative_point"
)


# ------------------------------------------------------------
# Find NO CSDs
# ------------------------------------------------------------

no_indices = (
    csds_projected[
        csds_projected[
            "CSDTYPE"
        ].astype(str).str.upper()
        == "NO"
    ]
    .index
    .tolist()
)


print(
    "NO CSDs found:",
    len(no_indices)
)


# ------------------------------------------------------------
# Representative points of all CSDs
#
# These are used to determine whether another
# CSD lies within a hole of an NO CSD.
# ------------------------------------------------------------

all_candidate_points = (
    csds_projected.geometry
    .representative_point()
)


# ------------------------------------------------------------
# Special treatment for NO CSDs
# ------------------------------------------------------------

no_diagnostics = []


for no_index in no_indices:

    no_row = (
        csds_projected.loc[
            no_index
        ]
    )

    no_geometry = (
        no_row.geometry
    )

    no_csd_uid = str(
        no_row["CSDUID"]
    )

    no_csd_name = (
        no_row["CSDNAME"]
        if "CSDNAME"
        in csds_projected.columns
        else no_csd_uid
    )


    # --------------------------------------------------------
    # Create the outer footprint of the NO CSD,
    # deliberately filling its holes.
    # --------------------------------------------------------

    outer_shell = (
        outer_shell_only(
            no_geometry
        )
    )


    island_indices = []


    # --------------------------------------------------------
    # Search all other CSDs
    # --------------------------------------------------------

    for candidate_index, candidate_row in (
        csds_projected.iterrows()
    ):

        if (
            candidate_index
            == no_index
        ):
            continue


        candidate_type = str(
            candidate_row[
                "CSDTYPE"
            ]
        ).upper()


        # IRI CSDs are deliberately ignored

        if (
            candidate_type
            == "IRI"
        ):
            continue


        candidate_point = (
            all_candidate_points.loc[
                candidate_index
            ]
        )


        # ----------------------------------------------------
        # Candidate must:
        #
        # 1. be inside the outer extent of the NO CSD
        #
        # 2. NOT actually be inside the NO geometry
        #
        # The second rule identifies polygons sitting
        # within holes in the NO CSD.
        # ----------------------------------------------------

        inside_outer_shell = (
            outer_shell.covers(
                candidate_point
            )
        )

        inside_actual_no = (
            no_geometry.covers(
                candidate_point
            )
        )


        if (
            inside_outer_shell
            and not inside_actual_no
        ):

            island_indices.append(
                candidate_index
            )


    # --------------------------------------------------------
    # No qualifying islands:
    # keep ordinary representative point
    # --------------------------------------------------------

    if (
        len(island_indices)
        == 0
    ):

        no_diagnostics.append(
            {
                "CSDUID": no_csd_uid,
                "CSDNAME": no_csd_name,
                "Island_Count": 0,
                "Point_Method":
                    "representative_point"
            }
        )

        continue


    # --------------------------------------------------------
    # Get representative points of the qualifying
    # island CSDs
    # --------------------------------------------------------

    island_points = [
        all_candidate_points.loc[
            idx
        ]
        for idx
        in island_indices
    ]


    # --------------------------------------------------------
    # Find the centre of those island points
    # --------------------------------------------------------

    island_centre = (
        MultiPoint(
            island_points
        )
        .centroid
    )


    # --------------------------------------------------------
    # If the centre itself lies inside the NO CSD,
    # use it directly.
    #
    # Usually it may instead fall in one of the holes.
    # In that case, find the nearest point belonging
    # to the actual NO geometry.
    # --------------------------------------------------------

    if (
        no_geometry.covers(
            island_centre
        )
    ):

        adjusted_point = (
            island_centre
        )

        point_method = (
            "NO_island_centre"
        )

    else:

        adjusted_point = (
            nearest_points(
                no_geometry,
                island_centre
            )[0]
        )

        point_method = (
            "NO_nearest_to_island_centre"
        )


    # Replace the normal point

    csd_points.at[
        no_index,
        "geometry"
    ] = adjusted_point


    csd_points.at[
        no_index,
        "Point_Method"
    ] = point_method


    # --------------------------------------------------------
    # Diagnostics
    # --------------------------------------------------------

    island_names = []

    for idx in island_indices:

        if (
            "CSDNAME"
            in csds_projected.columns
        ):

            island_names.append(
                str(
                    csds_projected.at[
                        idx,
                        "CSDNAME"
                    ]
                )
            )

        else:

            island_names.append(
                str(
                    csds_projected.at[
                        idx,
                        "CSDUID"
                    ]
                )
            )


    no_diagnostics.append(
        {
            "CSDUID": no_csd_uid,
            "CSDNAME": no_csd_name,
            "Island_Count":
                len(island_indices),
            "Point_Method":
                point_method,
            "Island_CSDs":
                " | ".join(
                    island_names
                )
        }
    )


# ------------------------------------------------------------
# Print NO diagnostics
# ------------------------------------------------------------

print()
print(
    "NO CSD POINT VALIDATION"
)

print(
    "-----------------------"
)


diagnostics_df = pd.DataFrame(
    no_diagnostics
)


if (
    len(diagnostics_df)
    > 0
):

    print(
        diagnostics_df.to_string(
            index=False
        )
    )

else:

    print(
        "No NO CSDs found."
    )


# ------------------------------------------------------------
# Convert points back to longitude / latitude
# ------------------------------------------------------------

csd_points = (
    csd_points.to_crs(
        "EPSG:4326"
    )
)


csd_points[
    "Longitude"
] = (
    csd_points.geometry.x
)


csd_points[
    "Latitude"
] = (
    csd_points.geometry.y
)


# ------------------------------------------------------------
# Make normal dataframe for joining
# ------------------------------------------------------------

lookup_columns = [
    "CSDUID",
    "Longitude",
    "Latitude"
]


if (
    "CSDNAME"
    in csd_points.columns
):

    lookup_columns.insert(
        1,
        "CSDNAME"
    )


csd_lookup = pd.DataFrame(
    csd_points[
        lookup_columns
    ]
)


# ============================================================
# 3. ONTARIO MUNICIPAL BOUNDARIES
# ============================================================

print()
print(
    "Reading Ontario municipal boundaries..."
)

municipal = gpd.read_file(
    ontario_municipal_file
)

print(
    "Municipal rows:",
    len(municipal)
)

print(
    "Original municipal CRS:",
    municipal.crs
)


municipal_web = (
    municipal.to_crs(
        "EPSG:4326"
    )
)


municipal_web.to_file(
    municipal_output,
    driver="GeoJSON"
)

print()
print("Saved:")
print(municipal_output)


# ============================================================
# 4. READ COMMUTING DATA
# ============================================================

print()
print(
    "Reading commuting data..."
)

con = duckdb.connect()


flows = con.execute(
    f"""
    SELECT
        CAST(
            Home_CSDUID
            AS VARCHAR
        ) AS Home_CSDUID,

        CAST(
            Work_CSDUID
            AS VARCHAR
        ) AS Work_CSDUID,

        CAST(
            DGUID
            AS VARCHAR
        ) AS DGUID,

        CAST(
            Work_DGUID
            AS VARCHAR
        ) AS Work_DGUID,

        Province,

        TRY_CAST(
            "Gender (3):Total - Gender[1]"
            AS DOUBLE
        ) AS Commuters

    FROM read_parquet(
        '{commuting_file}'
    )
    """
).df()


con.close()


print(
    "Commuting rows:",
    len(flows)
)


# ============================================================
# 5. CREATE HOME CSD LOOKUP
# ============================================================

home_lookup = (
    csd_lookup.copy()
)


home_rename = {
    "CSDUID":
        "Home_CSDUID",

    "Longitude":
        "Home_Longitude",

    "Latitude":
        "Home_Latitude"
}


if (
    "CSDNAME"
    in home_lookup.columns
):

    home_rename[
        "CSDNAME"
    ] = (
        "Home_CSDNAME"
    )


home_lookup = (
    home_lookup.rename(
        columns=home_rename
    )
)


# ============================================================
# 6. CREATE WORK CSD LOOKUP
# ============================================================

work_lookup = (
    csd_lookup.copy()
)


work_rename = {
    "CSDUID":
        "Work_CSDUID",

    "Longitude":
        "Work_Longitude",

    "Latitude":
        "Work_Latitude"
}


if (
    "CSDNAME"
    in work_lookup.columns
):

    work_rename[
        "CSDNAME"
    ] = (
        "Work_CSDNAME"
    )


work_lookup = (
    work_lookup.rename(
        columns=work_rename
    )
)


# ============================================================
# 7. JOIN HOME AND WORK LOCATIONS
# ============================================================

flows = flows.merge(
    home_lookup,
    on="Home_CSDUID",
    how="left"
)


flows = flows.merge(
    work_lookup,
    on="Work_CSDUID",
    how="left"
)


# ============================================================
# 8. VALIDATE GEOGRAPHIC MATCHES
# ============================================================

missing_home = flows[
    flows[
        "Home_Longitude"
    ].isna()
]


missing_work = flows[
    flows[
        "Work_CSDUID"
    ].notna()
    &
    flows[
        "Work_Longitude"
    ].isna()
]


missing_work_dguid = flows[
    flows[
        "Work_CSDUID"
    ].isna()
]


print()
print("VALIDATION")
print("----------")

print(
    "Total commuting rows:",
    len(flows)
)

print(
    "Rows missing Home CSD geometry:",
    len(missing_home)
)

print(
    "Rows with Work_CSDUID but no matching geometry:",
    len(missing_work)
)

print(
    "Rows with no Work_CSDUID:",
    len(missing_work_dguid)
)


# ============================================================
# 9. KEEP ROWS THAT CAN ACTUALLY BE DRAWN
# ============================================================

drawable = flows[
    flows[
        "Home_Longitude"
    ].notna()
    &
    flows[
        "Work_Longitude"
    ].notna()
].copy()


same_csd = drawable[
    drawable[
        "Home_CSDUID"
    ]
    ==
    drawable[
        "Work_CSDUID"
    ]
].copy()


cross_csd = drawable[
    drawable[
        "Home_CSDUID"
    ]
    !=
    drawable[
        "Work_CSDUID"
    ]
].copy()


print()
print(
    "Drawable rows:",
    len(drawable)
)

print(
    "Within-CSD rows:",
    len(same_csd)
)

print(
    "Cross-CSD flow rows:",
    len(cross_csd)
)


# ============================================================
# 10. CREATE FLOW LINES
# ============================================================

cross_csd[
    "geometry"
] = cross_csd.apply(

    lambda row: LineString(
        [
            (
                row[
                    "Home_Longitude"
                ],
                row[
                    "Home_Latitude"
                ]
            ),
            (
                row[
                    "Work_Longitude"
                ],
                row[
                    "Work_Latitude"
                ]
            )
        ]
    ),

    axis=1
)


flow_gdf = gpd.GeoDataFrame(
    cross_csd,
    geometry="geometry",
    crs="EPSG:4326"
)


# ============================================================
# 11. EXPORT COMMUTER FLOW GEOJSON
# ============================================================

flow_gdf.to_file(
    flows_output,
    driver="GeoJSON"
)


print()
print("Saved:")
print(flows_output)


# ============================================================
# FINAL SUMMARY
# ============================================================

print()
print(
    "========================================"
)

print(
    "WEBSITE FILES CREATED"
)

print(
    "========================================"
)


print()
print(
    "CSD boundaries:"
)

print(
    csd_output
)


print()
print(
    "Ontario municipal boundaries:"
)

print(
    municipal_output
)


print()
print(
    "Commuter flows:"
)

print(
    flows_output
)


print()
print(
    "Flow rows exported:",
    len(flow_gdf)
)


print()
print(
    "NO CSDs processed:",
    len(no_indices)
)


print()
print("Finished.")