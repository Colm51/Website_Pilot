import pandas as pd

input_file = (
    "...fir_data_2021.csv"
)

output_file = (
    "...municipalities_data_2021.xlsx"
)

# --------------------------------------------------
# Read only the fields needed for the municipal crosswalk
# --------------------------------------------------

df = pd.read_csv(
    input_file,
    usecols=[
        "ASSESSMENT_CODE",
        "MUNICIPALITY_DESC",
        "UT_NUMBER",
        "TIER_CODE"
    ],
    dtype={
        "ASSESSMENT_CODE": str,
        "MUNICIPALITY_DESC": str,
        "UT_NUMBER": str,
        "TIER_CODE": str
    }
)

# --------------------------------------------------
# Clean text fields
# --------------------------------------------------

for col in [
    "ASSESSMENT_CODE",
    "MUNICIPALITY_DESC",
    "UT_NUMBER",
    "TIER_CODE"
]:
    df[col] = df[col].str.strip()

# Preserve municipality IDs as 4-character text
df["ASSESSMENT_CODE"] = df["ASSESSMENT_CODE"].str.zfill(4)

# --------------------------------------------------
# Create one municipality-level record
# --------------------------------------------------

muni = (
    df[
        [
            "ASSESSMENT_CODE",
            "MUNICIPALITY_DESC",
            "UT_NUMBER",
            "TIER_CODE"
        ]
    ]
    .drop_duplicates()
)

# --------------------------------------------------
# Validate municipality-level data
# --------------------------------------------------

problems = (
    muni.groupby("ASSESSMENT_CODE")
    .size()
)

problems = problems[problems > 1]

if len(problems) > 0:
    print("WARNING: Some ASSESSMENT_CODE values have inconsistent data:")
    print(problems)
else:
    print("Validation passed: one record per ASSESSMENT_CODE.")

# One row per municipality
muni = muni.drop_duplicates(
    subset="ASSESSMENT_CODE"
).copy()

# --------------------------------------------------
# Build upper-tier lookup
# --------------------------------------------------

ut_lookup = (
    muni[
        muni["TIER_CODE"] == "UT"
    ][
        [
            "UT_NUMBER",
            "ASSESSMENT_CODE",
            "MUNICIPALITY_DESC"
        ]
    ]
    .rename(
        columns={
            "ASSESSMENT_CODE": "UT_ID",
            "MUNICIPALITY_DESC": "UT_Name"
        }
    )
)

# --------------------------------------------------
# Attach upper-tier information
# --------------------------------------------------

muni = muni.merge(
    ut_lookup,
    on="UT_NUMBER",
    how="left"
)

# For upper tiers, UT_ID and UT_Name are their own values
mask = muni["TIER_CODE"] == "UT"

muni.loc[
    mask,
    "UT_ID"
] = muni.loc[
    mask,
    "ASSESSMENT_CODE"
]

muni.loc[
    mask,
    "UT_Name"
] = muni.loc[
    mask,
    "MUNICIPALITY_DESC"
]

# Preserve UT_ID as 4-character text
muni["UT_ID"] = (
    muni["UT_ID"]
    .astype("string")
    .str.zfill(4)
)

# --------------------------------------------------
# Sort
# --------------------------------------------------

muni = muni.sort_values(
    "ASSESSMENT_CODE"
).reset_index(drop=True)

# --------------------------------------------------
# Validation summary
# --------------------------------------------------

print()
print("TIER COUNTS:")
print(muni["TIER_CODE"].value_counts())

print()
print("Municipalities:", len(muni))

missing_ut = muni[
    muni["TIER_CODE"].isin(["LT", "UT"])
    & muni["UT_ID"].isna()
]

print("LT/UT municipalities with no UT_ID:", len(missing_ut))

if len(missing_ut) > 0:
    print()
    print("MISSING UT RELATIONSHIPS:")
    print(
        missing_ut[
            [
                "ASSESSMENT_CODE",
                "MUNICIPALITY_DESC",
                "UT_NUMBER",
                "TIER_CODE"
            ]
        ].to_string(index=False)
    )

# --------------------------------------------------
# Write to Excel
# --------------------------------------------------

with pd.ExcelWriter(
    output_file,
    engine="openpyxl"
) as writer:

    muni.to_excel(
        writer,
        sheet_name="Municipalities",
        index=False
    )

    worksheet = writer.book["Municipalities"]

    # Preserve ID fields as text in Excel
    for col in ["A", "C", "E"]:
        for cell in worksheet[col]:
            cell.number_format = "@"

    worksheet.freeze_panes = "A2"
    worksheet.auto_filter.ref = worksheet.dimensions

    # Autofit columns
    for column_cells in worksheet.columns:
        max_length = 0

        for cell in column_cells:
            value = "" if cell.value is None else str(cell.value)
            max_length = max(max_length, len(value))

        worksheet.column_dimensions[
            column_cells[0].column_letter
        ].width = min(max_length + 2, 40)

print()
print("Saved to:")
print(output_file)