(function () {
  const projectSelect = document.querySelector("[data-project-jump]");

  if (!projectSelect) {
    return;
  }

  const projectHeadings = document.querySelectorAll(".projects-page .trip-card > h4");
  const usedIds = new Set(Array.from(document.querySelectorAll("[id]"), (element) => element.id));
  let currentCategory = null;
  let currentGroup = null;

  function createHeadingId(heading) {
    const baseId = `project-${heading.textContent
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")}`;
    let id = baseId;
    let suffix = 2;

    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    heading.id = id;
    usedIds.add(id);
    return id;
  }

  projectHeadings.forEach((heading) => {
    const category = heading.closest(".project-category");

    if (category !== currentCategory) {
      currentCategory = category;
      currentGroup = null;

      if (category) {
        const categoryHeading = category.querySelector("h3");
        currentGroup = document.createElement("optgroup");
        currentGroup.label = categoryHeading ? categoryHeading.textContent.trim() : "Projects";
        projectSelect.append(currentGroup);
      }
    }

    const option = document.createElement("option");
    option.value = heading.id || createHeadingId(heading);
    option.textContent = heading.textContent.trim();
    (currentGroup || projectSelect).append(option);
  });

  projectSelect.addEventListener("change", () => {
    const heading = document.getElementById(projectSelect.value);

    if (!heading) {
      return;
    }

    if (window.location.hash === `#${heading.id}`) {
      heading.scrollIntoView({ block: "start" });
    } else {
      window.location.hash = heading.id;
    }
  });
})();

(function () {
  const lightbox = document.getElementById("lightbox");

  if (!lightbox) {
    return;
  }

  const lightboxImage = lightbox.querySelector(".lightbox-image");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const closeButton = lightbox.querySelector(".lightbox-close");
  const photoButtons = document.querySelectorAll(".photo-button");
  let activeTrigger = null;
  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function openLightbox(button) {
    const image = button.querySelector("img");
    activeTrigger = button;
    lightboxImage.src = button.dataset.full;
    lightboxImage.alt = image ? image.alt : "";
    lightboxCaption.textContent = button.dataset.caption || "";
    lightbox.hidden = false;
    document.body.classList.add("lightbox-open");
    closeButton.focus();
  }

  function closeLightbox() {
    if (lightbox.hidden) {
      return;
    }

    lightbox.hidden = true;
    lightboxImage.src = "";
    document.body.classList.remove("lightbox-open");

    if (activeTrigger) {
      activeTrigger.focus();
      activeTrigger = null;
    }
  }

  photoButtons.forEach((button) => {
    button.addEventListener("click", () => openLightbox(button));
  });

  closeButton.addEventListener("click", closeLightbox);

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLightbox();
    }

    if (event.key !== "Tab" || lightbox.hidden) {
      return;
    }

    const focusableElements = Array.from(lightbox.querySelectorAll(focusableSelector));
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  });
})();
