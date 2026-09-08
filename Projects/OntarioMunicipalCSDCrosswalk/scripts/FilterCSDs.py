"""Extract Ontario census subdivisions from a Statistics Canada boundary file."""

import argparse
from pathlib import Path

import geopandas as gpd


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_file", type=Path, help="Canada CSD boundary file")
    parser.add_argument("output_file", type=Path, help="Ontario CSD output file")
    parser.add_argument("--province-code", default="35", help="Statistics Canada PRUID")
    return parser.parse_args()


def main():
    args = parse_args()
    subdivisions = gpd.read_file(args.input_file)
    ontario = subdivisions[
        subdivisions["PRUID"].astype(str) == args.province_code
    ].copy()
    ontario = ontario.to_crs("EPSG:4326")

    args.output_file.parent.mkdir(parents=True, exist_ok=True)
    args.output_file.unlink(missing_ok=True)
    ontario.to_file(args.output_file)

    print(f"Saved {len(ontario):,} Ontario CSDs")
    print(args.output_file)


if __name__ == "__main__":
    main()
