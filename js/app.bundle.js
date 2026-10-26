(function () {                                            // Begin an immediately invoked function so the script runs at once and keeps its variables private.
  "use strict";                                           // Enable strict mode to help catch common JavaScript mistakes.
  document.documentElement.dataset.scriptLoaded = "true"; // Mark the document root to show that this script has loaded.
  var status = document.getElementById("script-status");  // Find the page element reserved for the script loading message.
  if (status) {                                           // Continue only when the page contains the status element.
    status.textContent = "Her is some example loaded JavaScript js/app.bundle.js."; // Replace the status text to confirm the JavaScript ran.
    status.classList.add("is-ready");                     // Add a CSS class that can style the ready status.
  } 
})();                                                     // Immediately invoke the function to run the script.