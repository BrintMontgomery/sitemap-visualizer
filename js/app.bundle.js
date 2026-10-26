(function () {
  "use strict";

  document.documentElement.dataset.scriptLoaded = "true";

  var status = document.getElementById("script-status");
  if (status) {
    status.textContent = "Her is some example loaded JavaScript js/app.bundle.js.";
    status.classList.add("is-ready");
  }
})();