"""Match Ontario municipalities to CSDs and create spatial and Excel outputs."""

import argparse
from pathlib import Path

import geopandas as gpd
import pandas as pd


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("municipal_file", type=Path, help="Clipped municipal boundaries")
    parser.add_argument("csd_file", type=Path, help="Ontario CSD boundaries")
    parser.add_argument("output_layer", type=Path, help="Joined geospatial output")
    parser.add_argument("output_excel", type=Path, help="Crosswalk workbook output")
    return parser.parse_args()


def main():
    args = parse_args()
    municipalities = gpd.read_file(args.municipal_file)
    subdivisions = gpd.read_file(args.csd_file).to_crs(municipalities.crs)

    municipal_points = municipalities.copy()
    municipal_points["geometry"] = municipalities.geometry.representative_point()
    matched = gpd.sjoin(
        municipal_points,
        subdivisions[["CSDUID", "CSDNAME", "geometry"]],
        how="left",
        predicate="within",
    ).drop(columns=["index_right"], errors="ignore")

    if len(matched) != len(municipalities):
        raise ValueError(
            f"Spatial join produced {len(matched)} rows from "
            f"{len(municipalities)} municipalities. Some points may match multiple CSDs."
        )

    municipal_with_csd = municipalities.copy()
    municipal_with_csd["CSDUID"] = matched["CSDUID"].values
    municipal_with_csd["CSDNAME"] = matched["CSDNAME"].values

    args.output_layer.parent.mkdir(parents=True, exist_ok=True)
    args.output_layer.unlink(missing_ok=True)
    municipal_with_csd.to_file(args.output_layer)

    columns = [
        "MUNICIPAL_TYPE",
        "MUNICIPAL_NAME",
        "ASSESSMENT_CODE",
        "MUNICIPAL_NAME_SHORTFORM",
        "CSDUID",
        "CSDNAME",
    ]
    crosswalk = municipal_with_csd[columns].copy().sort_values(
        "MUNICIPAL_NAME", na_position="last"
    )
    matched_csd_uids = set(crosswalk["CSDUID"].dropna().astype(str))
    unmatched_csds = (
        subdivisions.loc[
            ~subdivisions["CSDUID"].astype(str).isin(matched_csd_uids),
            ["CSDUID", "CSDNAME"],
        ]
        .drop_duplicates()
        .sort_values("CSDNAME")
    )

    args.output_excel.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(args.output_excel, engine="openpyxl") as writer:
        crosswalk.to_excel(writer, sheet_name="Municipal CSD Crosswalk", index=False)
        unmatched_csds.to_excel(writer, sheet_name="Unmatched CSDs", index=False)

        for sheet in writer.book.worksheets:
            for column_cells in sheet.columns:
                max_length = max(
                    len(str(cell.value)) if cell.value is not None else 0
                    for cell in column_cells
                )
                sheet.column_dimensions[column_cells[0].column_letter].width = min(
                    max_length + 2, 50
                )

    print("Municipalities:", len(municipalities))
    print("Municipalities with CSD match:", crosswalk["CSDUID"].notna().sum())
    print("Municipalities without CSD match:", crosswalk["CSDUID"].isna().sum())
    print("CSDs not matched to a municipality:", len(unmatched_csds))
    print("Created:")
    print(args.output_layer)
    print(args.output_excel)


if __name__ == "__main__":
    main()
