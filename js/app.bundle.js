(function () {
  "use strict";

  document.documentElement.dataset.appReady = "true";

  var status = document.getElementById("application-status");
  if (status) {
    status.textContent = "Application shell ready. No sitemap data has been loaded.";
    status.classList.add("is-ready");
  }
})();
