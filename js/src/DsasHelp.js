// The javascript used by the DSAS help.html page

// Relies on "marked.js" being imported first
import { setOptions, parse } from "marked";

// These functions are in another file
/* globals modal_message fail_loggedin dsas_origin _ */

// DSAS version variable
const dsasVersion = "1.1.2";

function dsasHeadings() {
    const hs = Array.prototype.slice.call(document.querySelectorAll("h1, h2, h3"));
    const ph = hs.map((h) => ({
        title: h.innerText,
        depth: h.nodeName.replace(/\D/g, ""),
        id: h.getAttribute("id"),
    }));
    return ph;
}

export function dsas_display_version() {
    document.getElementById("Version").innerHTML = "<p><span data-i18n>DSAS Version</span> : " + dsasVersion + "</p>";
}
window.dsas_display_version = dsas_display_version;

function dsasHelpTOC() {
    let body = "<ul class=\"list-unstyled\">";
    let lvl = 1;
    let c = 0;
    const ph = dsasHeadings();

    while (lvl < ph[0].depth) {
    // Special case. Stupid idiot not starting with h1 !!
        body = body + "<li><a href=\"#toc_submenu" + c + "\" data-bs-toggle=\"collapse\" aria-expanded=\"false\" "
      + "class=\"dropdown-toggle dropdown-toggle-split" + (lvl === 1 ? "" : " ms-2") + "\">Main</a>"
      + "<ul class=\"list-unstyled small collapse\" id=\"toc_submenu" + c + "\">";
        lvl += 1;
        c += 1;
    }
    for (let i = 0; i < ph.length; i += 1) {
        const h = ph[i];
        while (lvl > h.depth) {
            // Close the submenu
            body += "</ul></li>";
            lvl -= 1;
        }
        lvl = h.depth;
        if (i !== (ph.length - 1) && (lvl < ph[i + 1].depth)) {
            body = body + "<li" + (lvl === 1 ? "" : " class=\"ms-2\"") + "><a href=\"#" + h.id + "\">" + h.title + "</a>"
            + "<a href=\"#toc_submenu" + c + "\" data-bs-toggle=\"collapse\" aria-expanded=\"false\" "
            + "class=\"dropdown-toggle dropdown-toggle-split\"></a>"
            + "<ul class=\"list-unstyled small collapse\" id=\"toc_submenu" + c + "\">";
            c += 1;
        } else if (lvl === 1) {
            body += "<li><a href=\"#" + h.id + "\">" + h.title + "</a></li>";
        } else if (lvl === 2) {
            body += "<li class=\"ms-2\"><a href=\"#" + h.id + "\">" + h.title + "</a></li>";
        } else {
            body += "<li class=\"ms-4\"><a href=\"#" + h.id + "\">" + h.title + "</a></li>";
        }
    }
    while (lvl > 1) {
        body += "</ul></li>";
        lvl -= 1;
    }

    document.getElementById("toc").innerHTML = body + "<ul>";
}

export function dsas_display_help() {
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get("language");
    const uri = (lang ? "Documentation_" + lang + ".md" : "Documentation_en.md");

    fetch(uri).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        // If user text was passed here we'd need to sanitize it, but the documentation
        // is supplied with the DSAS.
        // FIXME Fortigate SSL VPN F***'s up here. Kludge to fix it.
        setOptions({ baseUrl: dsas_origin() });
        document.getElementById("Documentation").innerHTML = "<article class=\"markdown-body\">"
        + parse(text).replace(/fgt_sslvpn.url_rewrite\(/g, "") + "</article>";
        dsasHelpTOC();
    }).catch((error) => {
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error during documentation download : ") + error.statusText); }
    });
}
window.dsas_display_help = dsas_display_help;
