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
