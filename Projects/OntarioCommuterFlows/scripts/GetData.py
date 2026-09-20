#download StatsCan CSD

import zipfile
import requests
from pathlib import Path

# -----------------------------
# OUTPUT FOLDER
# -----------------------------
out_folder = Path("...Commuting")


out_folder.mkdir(parents=True, exist_ok=True)

# -----------------------------
# STATCAN FILE
# -----------------------------
statcan_url = "https://www150.statcan.gc.ca/n1/tbl/csv/98100459-eng.zip"

zip_path = out_folder / "98100459-eng.zip"

# -----------------------------
# DOWNLOAD
# -----------------------------
print("Downloading StatCan table...")

r = requests.get(statcan_url)
r.raise_for_status()

zip_path.write_bytes(r.content)

print("Downloaded:", zip_path)

# -----------------------------
# EXTRACT
# -----------------------------
print("Extracting...")

with zipfile.ZipFile(zip_path, "r") as z:
    z.extractall(out_folder)

# -----------------------------
# FIND MAIN CSV
# -----------------------------
csv_files = list(out_folder.glob("*.csv"))

if not csv_files:
    raise FileNotFoundError("No CSV files were found after extraction.")

commuting_csv = max(csv_files, key=lambda p: p.stat().st_size)

print()
print("Main StatCan CSV:")
print(commuting_csv)
print()
print("Finished.")
