import pandas as pd
import re
import unicodedata

fir_file = (
    "...municipalities_data_2021.xlsx"
)

amo_file = (
    "...separated_municipalities_AMO.csv"
)

output_file = (
    "...municipalities_data_2021_with_separated.xlsx"
)

# --------------------------------------------------
# Read source files
# --------------------------------------------------

fir = pd.read_excel(
    fir_file,
    dtype={
        "ASSESSMENT_CODE": str,
        "UT_NUMBER": str,
        "UT_ID": str
    }
)

amo = pd.read_csv(amo_file)

# --------------------------------------------------
# Standardize ID fields
# --------------------------------------------------

fir["ASSESSMENT_CODE"] = (
    fir["ASSESSMENT_CODE"]
    .astype(str)
    .str.strip()
    .str.zfill(4)
)

fir["UT_ID"] = (
    fir["UT_ID"]
    .astype(str)
    .str.strip()
    .str.zfill(4)
)

# --------------------------------------------------
# Function to normalize municipality names
# --------------------------------------------------

def normalize_municipality(name):
    if pd.isna(name):
        return None

    name = unicodedata.normalize("NFKC", str(name))
    name = name.replace("\xa0", " ")

    name = name.upper().strip()
    name = re.sub(r"\s+", " ", name)

    name = name.replace(".", "")
    name = name.replace(",", "")
    name = name.replace("&", "AND")

    # Remove prefixes used in AMO names
    name = re.sub(
        r"^(SEPARATED TOWN|CITY|TOWN|TOWNSHIP|MUNICIPALITY|VILLAGE)\s+OF\s+",
        "",
        name
    )

    # Remove FIR municipality-type suffixes
    name = re.sub(
        r"\s+(C|T|TP|ST|V)$",
        "",
        name
    )

    name = re.sub(r"\s+", " ", name).strip()

    return name

# --------------------------------------------------
# Create helper match fields
# --------------------------------------------------

fir["MATCH_NAME"] = fir["MUNICIPALITY_DESC"].apply(
    normalize_municipality
)

amo["MATCH_NAME"] = amo["Municipality"].apply(
    normalize_municipality
)

# --------------------------------------------------
# Match AMO separated municipalities to FIR IDs
# --------------------------------------------------

amo_matched = amo.merge(
    fir[
        [
            "ASSESSMENT_CODE",
            "MUNICIPALITY_DESC",
            "MATCH_NAME"
        ]
    ],
    on="MATCH_NAME",
    how="left"
)

# --------------------------------------------------
# Validate AMO matching
# --------------------------------------------------

unmatched = amo_matched[
    amo_matched["ASSESSMENT_CODE"].isna()
]

if len(unmatched) > 0:
    print("ERROR: Some AMO municipalities did not match FIR data:")
    print(
        unmatched[
            [
                "Geographic_County",
                "Municipality",
                "MATCH_NAME"
            ]
        ].to_string(index=False)
    )

    raise ValueError("AMO matching failed.")

print(
    f"AMO validation passed: "
    f"{len(amo_matched)} separated municipalities matched."
)

# --------------------------------------------------
# Create separated-municipality lookup
# --------------------------------------------------

separated_lookup = amo_matched[
    [
        "ASSESSMENT_CODE",
        "Geographic_County"
    ]
].copy()

separated_lookup["Separated"] = 1

# --------------------------------------------------
# Join separated flag onto FIR municipality data
# --------------------------------------------------

result = fir.merge(
    separated_lookup,
    on="ASSESSMENT_CODE",
    how="left"
)

# All municipalities not appearing in AMO list = 0
result["Separated"] = (
    result["Separated"]
    .fillna(0)
    .astype(int)
)

# Remove temporary matching field
result = result.drop(
    columns=["MATCH_NAME"]
)

# --------------------------------------------------
# Put final fields in desired order
# --------------------------------------------------

result = result[
    [
        "ASSESSMENT_CODE",
        "MUNICIPALITY_DESC",
        "UT_NUMBER",
        "TIER_CODE",
        "UT_ID",
        "UT_Name",
        "Separated",
        "Geographic_County"
    ]
]

# --------------------------------------------------
# Validation
# --------------------------------------------------

print()
print("Rows:", len(result))
print("Separated municipalities:", result["Separated"].sum())

print()
print("Separated municipality records:")

print(
    result[
        result["Separated"] == 1
    ].to_string(index=False)
)

# Confirm municipality ID remains unique
duplicates = result[
    result.duplicated(
        subset="ASSESSMENT_CODE",
        keep=False
    )
]

if len(duplicates) > 0:
    print()
    print("ERROR: Duplicate ASSESSMENT_CODE values found:")
    print(
        duplicates.to_string(index=False)
    )

    raise ValueError(
        "ASSESSMENT_CODE is not unique."
    )
else:
    print()
    print("Validation passed: ASSESSMENT_CODE is unique.")

# --------------------------------------------------
# Save final Excel dataset
# --------------------------------------------------

result.to_excel(
    output_file,
    index=False
)

print()
print("Saved to:")
print(output_file)