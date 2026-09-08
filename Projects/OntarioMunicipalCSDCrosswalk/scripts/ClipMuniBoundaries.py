"""Clip dissolved municipal boundaries to the Ontario land boundary."""

import argparse
from pathlib import Path

import geopandas as gpd


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("municipal_file", type=Path, help="Dissolved municipal boundary file")
    parser.add_argument("ontario_file", type=Path, help="Ontario cartographic boundary file")
    parser.add_argument("output_file", type=Path, help="Clipped output file")
    return parser.parse_args()


def main():
    args = parse_args()
    municipalities = gpd.read_file(args.municipal_file)
    ontario = gpd.read_file(args.ontario_file).to_crs(municipalities.crs)
    clipped = gpd.clip(municipalities, ontario)

    args.output_file.parent.mkdir(parents=True, exist_ok=True)
    args.output_file.unlink(missing_ok=True)
    clipped.to_file(args.output_file)

    print("Original municipalities:", len(municipalities))
    print("Clipped municipalities:", len(clipped))
    print("CRS:", clipped.crs)
    print("Saved:", args.output_file)


if __name__ == "__main__":
    main()
