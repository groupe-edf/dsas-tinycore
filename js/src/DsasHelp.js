//    DSAS - Tinycore
//    Copyright (C) 2021-2022  Electricite de France
//
//    This program is free software; you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation; either version 2 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License along
//    with this program; if not, write to the Free Software Foundation, Inc.,
//    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

// The javascript used by the DSAS help.html page

// Relies on "marked.js" being imported first
import "./github-markdown.min.css";
import "./dsas.css";
import { setOptions, parse } from "marked";
import { _ } from "./MultiLang";
import { modalMessage } from "./DsasModal";
import { failLoggedin, dsasOrigin } from "./DsasUtil";

// DSAS version variable
const dsasVersion = "2.0.0";

function dsasHeadings() {
    const hs = Array.prototype.slice.call(document.querySelectorAll("h1, h2, h3"));
    const ph = hs.map((h) => ({
        title: h.textContent,
        depth: h.nodeName.replace(/\D/g, ""),
        id: h.getAttribute("id"),
    }));
    return ph;
}

function dsasDisplayVersion() {
    document.getElementById("Version").textContent = _("DSAS Version") + " : " + dsasVersion;
}

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
        } else if (lvl === "1") {
            body += "<li><a href=\"#" + h.id + "\">" + h.title + "</a></li>";
        } else if (lvl === "2") {
            body += "<li class=\"ms-2\"><a href=\"#" + h.id + "\">" + h.title + "</a></li>";
        } else {
            body += "<li class=\"ms-4\"><a href=\"#" + h.id + "\">" + h.title + "</a></li>";
        }
    }
    while (lvl > 1) {
        body += "</ul></li>";
        lvl -= 1;
    }
    // FIXME Get rid of innerHTML
    // Not a security risk as document is supplied with the DSAS
    document.getElementById("toc").innerHTML = body + "<ul>";
}

export default function dsasDisplayHelp() {
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get("language");
    const uri = (lang ? "Documentation_" + lang + ".md" : "Documentation_en.md");

    dsasDisplayVersion();
    fetch(uri).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        // "Marked" has to use innerHTML as it returns a formatted string.
        // If user text was passed here we'd need to sanitize it, but the
        // documentation is supplied with the DSAS.
        // FIXME Fortigate SSL VPN F***'s up here. Kludge to fix it.
        setOptions({ baseUrl: dsasOrigin() });
        document.getElementById("Documentation").innerHTML = "<article class=\"markdown-body\">"
        + parse(text).replace(/fgt_sslvpn.url_rewrite\(/g, "") + "</article>";
        dsasHelpTOC();
    }).catch((error) => {
        if (!failLoggedin(error)) { modalMessage(_("Error during documentation download : ") + (error.message ? error.message : error)); }
    });
}
