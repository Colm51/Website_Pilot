"""Extract Ontario from a Statistics Canada province boundary file."""

import argparse
from pathlib import Path

import geopandas as gpd


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_file", type=Path, help="Canada province and territory boundary file")
    parser.add_argument("output_file", type=Path, help="Ontario GeoPackage output")
    parser.add_argument("--province-code", default="35", help="Statistics Canada PRUID")
    return parser.parse_args()


def main():
    args = parse_args()
    provinces = gpd.read_file(args.input_file)
    ontario = provinces[provinces["PRUID"].astype(str) == args.province_code].copy()

    if len(ontario) != 1:
        raise ValueError(f"Expected one Ontario feature; found {len(ontario)}")

    args.output_file.parent.mkdir(parents=True, exist_ok=True)
    args.output_file.unlink(missing_ok=True)
    ontario.to_file(args.output_file, driver="GPKG")

    print("Rows:", len(ontario))
    print("CRS:", ontario.crs)
    print("Saved:", args.output_file)


if __name__ == "__main__":
    main()
