const copyCommandButton = document.querySelector(".copy-command");
const metadataCommand = document.querySelector("#metadata-command");

if (copyCommandButton && metadataCommand) {
  copyCommandButton.addEventListener("click", async () => {
    const command = metadataCommand.textContent;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(command);
        return;
      } catch {}
    }

    const copyField = document.createElement("textarea");
    copyField.value = command;
    copyField.setAttribute("readonly", "");
    copyField.style.position = "fixed";
    copyField.style.opacity = "0";
    document.body.append(copyField);
    copyField.select();
    document.execCommand("copy");
    copyField.remove();
  });
}
