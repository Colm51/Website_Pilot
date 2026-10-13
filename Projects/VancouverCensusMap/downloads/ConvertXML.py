from pathlib import Path
import xml.etree.ElementTree as ET
import xlsxwriter


# ============================================================
# FILES
# ============================================================



folder = Path(
    "/Users/aidancarter/Desktop/CodexSandbox/VancouverDAs/StatsCanPrep"
)

folder.mkdir(parents=True, exist_ok=True)

xml_file = folder / "DF_DA_metadata.xml"

output_file = folder / "DF_DA_metadata.xlsx"


# ============================================================
# READ XML
# ============================================================

print("Reading metadata...")

tree = ET.parse(xml_file)
root = tree.getroot()


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def local_name(tag):
    """Remove the XML namespace from a tag."""
    return tag.split("}")[-1]


def child_text(element, child_name):
    """Return the English text from a child such as Name or Description."""

    matches = [
        child
        for child in element
        if local_name(child.tag) == child_name
    ]

    if not matches:
        return ""

    # Prefer English if language is specified
    for child in matches:
        lang = child.attrib.get(
            "{http://www.w3.org/XML/1998/namespace}lang",
            ""
        )

        if lang.lower() == "en":
            return (child.text or "").strip()

    return (matches[0].text or "").strip()


# ============================================================
# FIND ALL CODELISTS
# ============================================================

codelists = []

for element in root.iter():

    if local_name(element.tag) != "Codelist":
        continue

    codelist_id = element.attrib.get("id", "")
    codelist_name = child_text(element, "Name")
    codelist_description = child_text(element, "Description")

    codes = []

    for child in element:

        if local_name(child.tag) != "Code":
            continue

        code = child.attrib.get("id", "")
        name = child_text(child, "Name")
        description = child_text(child, "Description")

        codes.append(
            {
                "Code": code,
                "Name": name,
                "Description": description
            }
        )

    codelists.append(
        {
            "ID": codelist_id,
            "Name": codelist_name,
            "Description": codelist_description,
            "Codes": codes
        }
    )


print("Codelists found:", len(codelists))


# ============================================================
# CREATE EXCEL WORKBOOK
# ============================================================

workbook = xlsxwriter.Workbook(output_file)

header_format = workbook.add_format(
    {
        "bold": True,
        "bg_color": "#D9EAF7",
        "border": 1
    }
)

title_format = workbook.add_format(
    {
        "bold": True,
        "font_size": 14
    }
)

text_format = workbook.add_format(
    {
        "text_wrap": False
    }
)


# ============================================================
# SUMMARY SHEET
# ============================================================

summary = workbook.add_worksheet("Summary")

summary.write(
    0,
    0,
    "StatsCan 2021 Census Profile DA Metadata",
    title_format
)

headers = [
    "Codelist ID",
    "Codelist Name",
    "Description",
    "Number of codes"
]

for col, header in enumerate(headers):
    summary.write(
        2,
        col,
        header,
        header_format
    )


for row, codelist in enumerate(
    codelists,
    start=3
):

    summary.write(
        row,
        0,
        codelist["ID"]
    )

    summary.write(
        row,
        1,
        codelist["Name"]
    )

    summary.write(
        row,
        2,
        codelist["Description"]
    )

    summary.write(
        row,
        3,
        len(codelist["Codes"])
    )


summary.set_column("A:A", 30)
summary.set_column("B:B", 45)
summary.set_column("C:C", 60)
summary.set_column("D:D", 18)

summary.freeze_panes(3, 0)


# ============================================================
# CREATE A SHEET FOR EACH CODELIST
# ============================================================

used_sheet_names = set()

for index, codelist in enumerate(
    codelists,
    start=1
):

    # Excel sheet names are limited to 31 characters
    base_name = codelist["ID"] or f"Codelist_{index}"

    sheet_name = (
        base_name
        .replace("/", "_")
        .replace("\\", "_")
        .replace(":", "_")
        .replace("*", "_")
        .replace("?", "_")
        .replace("[", "_")
        .replace("]", "_")
    )[:31]

    original_name = sheet_name
    counter = 1

    while sheet_name in used_sheet_names:
        suffix = f"_{counter}"
        sheet_name = (
            original_name[:31 - len(suffix)]
            + suffix
        )
        counter += 1

    used_sheet_names.add(sheet_name)

    ws = workbook.add_worksheet(sheet_name)

    ws.write(
        0,
        0,
        "Codelist ID",
        header_format
    )

    ws.write(
        0,
        1,
        codelist["ID"]
    )

    ws.write(
        1,
        0,
        "Codelist Name",
        header_format
    )

    ws.write(
        1,
        1,
        codelist["Name"]
    )

    ws.write(
        2,
        0,
        "Description",
        header_format
    )

    ws.write(
        2,
        1,
        codelist["Description"]
    )

    # Table headers
    ws.write(
        4,
        0,
        "Code",
        header_format
    )

    ws.write(
        4,
        1,
        "Name",
        header_format
    )

    ws.write(
        4,
        2,
        "Description",
        header_format
    )

    for row, code_record in enumerate(
        codelist["Codes"],
        start=5
    ):

        # Store codes as text
        ws.write_string(
            row,
            0,
            str(code_record["Code"])
        )

        ws.write(
            row,
            1,
            code_record["Name"],
            text_format
        )

        ws.write(
            row,
            2,
            code_record["Description"],
            text_format
        )

    ws.set_column("A:A", 22)
    ws.set_column("B:B", 60)
    ws.set_column("C:C", 70)

    ws.freeze_panes(5, 0)

    if codelist["Codes"]:
        ws.autofilter(
            4,
            0,
            4 + len(codelist["Codes"]),
            2
        )


# ============================================================
# SPECIAL SHEET: ALL CODES
# ============================================================

all_codes = workbook.add_worksheet("All Codes")

all_headers = [
    "Codelist ID",
    "Codelist Name",
    "Code",
    "Name",
    "Description"
]

for col, header in enumerate(all_headers):
    all_codes.write(
        0,
        col,
        header,
        header_format
    )

row = 1

for codelist in codelists:

    for code_record in codelist["Codes"]:

        all_codes.write(
            row,
            0,
            codelist["ID"]
        )

        all_codes.write(
            row,
            1,
            codelist["Name"]
        )

        all_codes.write_string(
            row,
            2,
            str(code_record["Code"])
        )

        all_codes.write(
            row,
            3,
            code_record["Name"]
        )

        all_codes.write(
            row,
            4,
            code_record["Description"]
        )

        row += 1


all_codes.set_column("A:A", 28)
all_codes.set_column("B:B", 40)
all_codes.set_column("C:C", 18)
all_codes.set_column("D:D", 65)
all_codes.set_column("E:E", 70)

all_codes.freeze_panes(1, 0)

if row > 1:
    all_codes.autofilter(
        0,
        0,
        row - 1,
        4
    )


# ============================================================
# SAVE
# ============================================================

workbook.close()

print("\nDone.")
print("Excel metadata file:")
print(output_file)