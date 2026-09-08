"""Dissolve Ontario municipal boundary parts into one feature per municipality."""

import argparse
from pathlib import Path

import geopandas as gpd


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_file", type=Path, help="Downloaded municipal boundary file")
    parser.add_argument("output_file", type=Path, help="Dissolved output file")
    parser.add_argument("--id-field", default="MUNID", help="Municipality identifier field")
    return parser.parse_args()


def main():
    args = parse_args()
    municipalities = gpd.read_file(args.input_file)
    clean = municipalities.dissolve(by=args.id_field, as_index=False, aggfunc="first")

    args.output_file.parent.mkdir(parents=True, exist_ok=True)
    args.output_file.unlink(missing_ok=True)
    clean.to_file(args.output_file)

    print("Original rows:", len(municipalities))
    print("Clean rows:", len(clean))
    print("Saved:", args.output_file)


if __name__ == "__main__":
    main()
