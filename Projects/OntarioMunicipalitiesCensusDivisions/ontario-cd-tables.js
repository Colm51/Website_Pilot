const numericFields = new Set([
  "UT_Count",
  "ST_Count",
  "LT_Count",
  "Municipality_Count",
  "Separated_Count",
  "Has_Separated",
  "Separated",
  "overlap_percent",
]);

const textCollator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: false,
});

function compareValues(left, right, type) {
  if (left === "" && right === "") return 0;
  if (left === "") return 1;
  if (right === "") return -1;

  if (type === "number") {
    const leftNumber = Number(left);
    const rightNumber = Number(right);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }
  }

  return textCollator.compare(left, right);
}

function makeSortable(table) {
  const headers = [...table.querySelectorAll("thead th")];
  const body = table.tBodies[0];

  if (!body || headers.length === 0) return;

  const originalOrder = new Map(
    [...body.rows].map((row, index) => [row, index]),
  );
  let activeColumn = -1;
  let activeDirection = "none";

  headers.forEach((header, columnIndex) => {
    const fieldName = header.textContent.trim();
    const sortType = numericFields.has(fieldName) ? "number" : "text";
    const label = document.createElement("span");
    const indicator = document.createElement("span");
    const button = document.createElement("button");

    label.textContent = fieldName;
    indicator.className = "sortable-header-indicator";
    indicator.setAttribute("aria-hidden", "true");
    button.type = "button";
    button.className = "sortable-header-button";
    button.setAttribute("aria-label", `Sort by ${fieldName}`);
    button.append(label, indicator);

    header.textContent = "";
    header.dataset.sortType = sortType;
    header.setAttribute("aria-sort", "none");
    header.append(button);

    button.addEventListener("click", () => {
      const direction = activeColumn === columnIndex && activeDirection === "ascending"
        ? "descending"
        : "ascending";
      const rows = [...body.rows];

      rows.sort((leftRow, rightRow) => {
        const left = leftRow.cells[columnIndex]?.textContent.trim() ?? "";
        const right = rightRow.cells[columnIndex]?.textContent.trim() ?? "";
        const comparison = compareValues(left, right, sortType);

        if (comparison === 0) {
          return originalOrder.get(leftRow) - originalOrder.get(rightRow);
        }

        return direction === "ascending" ? comparison : -comparison;
      });

      body.append(...rows);
      headers.forEach((otherHeader) => {
        otherHeader.setAttribute("aria-sort", "none");
        otherHeader.querySelector(".sortable-header-indicator").textContent = "";
      });
      header.setAttribute("aria-sort", direction);
      indicator.textContent = direction === "ascending" ? "▲" : "▼";
      activeColumn = columnIndex;
      activeDirection = direction;
    });
  });
}

document
  .querySelectorAll(".ontario-cd-project .project-data-table")
  .forEach(makeSortable);
