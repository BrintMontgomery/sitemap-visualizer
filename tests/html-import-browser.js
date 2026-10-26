(function () {
  "use strict";
  document.getElementById("import").addEventListener("click", async function () {
    var result = document.getElementById("result");
    try {
      var imported = await SitemapHtmlImport.importFile(document.getElementById("file").files[0], SitemapContracts.createRun({ mode: "html-import" }), document.getElementById("source").value);
      result.textContent = JSON.stringify(imported, null, 2);
    } catch (error) { result.textContent = error.message; }
  });
})();
