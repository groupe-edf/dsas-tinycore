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

// The javascript used by the DSAS cert.html page
import { _, ml } from "./MultiLang";
import { modalMessage, modalErrors, modalAction } from "./DsasModal";
import {
    failLoggedin,
    clearFeedback,
    dateToLocale,
    certIsCa,
    certName,
} from "./DsasUtil";

function certExpiring(validTo) {
    // JS is time_t times 1000 'cause in milliseconds
    const tt = validTo * 1000;

    // EDF CA has a value of -1. What does that even mean !!
    if (tt < 0) return false;
    // Expiring if less than 6 months are left
    if (tt - Date.now() < 180 * 24 * 3600000) { return true; }
    return false;
}

function certExpired(validTo) {
    const tt = validTo * 1000;
    if (tt < 0) return false;
    if (tt - Date.now() < 0) { return true; }
    return false;
}

function timeToDate(t) {
    if (t <= 0) { return _("always"); }
    const c = new Intl.DateTimeFormat(ml.currentLanguage, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        timeZoneName: "short",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    return c.format(new Date(t * 1000));
}

function dsasCertRealDelete(name, finger) {
    const formData = new FormData();
    formData.append("op", "delete");
    formData.append("finger", finger);
    fetch("api/dsas-cert.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modalErrors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clearFeedback();
            // Disable ESLINT here as circular refering behind the functions
            /* eslint-disable-next-line no-use-before-define */
            dsasDisplayCert("cert");
            /* eslint-disable-next-line no-use-before-define */
            dsasDisplayCert("pubkey");
            /* eslint-disable-next-line no-use-before-define */
            dsasDisplayCert("gpg");
        }
    }).catch((error) => {
        modalMessage(_("Error : {0}", (error.message ? error.message : error)));
    });
}

function dsasCertDelete(name, finger) {
    const modalDSAS = document.getElementById("modalDSAS");
    modalAction(_("Delete the certificate ?"), () => { dsasCertRealDelete(name, finger); }, true);
    modalDSAS.setBody(_(" Name : {0}\r\n ID : {1}", name, finger.substr(0, 50)));
}

function certBody(c) {
    const cert = c; // Keep eslint happy
    delete cert.pem; // Don't display the PEM file, download button for that
    // Convert ValidFrom and ValidTo de something human readable
    cert.validFrom = dateToLocale(cert.validFrom);
    cert.validTo = dateToLocale(cert.validTo);

    // Tidy up the purposes, which I find ugly for the PHP openssl_x509_parse function
    const purposes = [];
    Object.keys(cert.purposes).forEach((key) => { purposes.push(cert.purposes[key][2]); });
    cert.purposes = purposes;

    return JSON.stringify(cert, null, 2);
}

function gpgBody(c) {
    const cert = c;
    delete cert.pem; // Don't display the PEM file, download button for that
    // Convert ValidFrom and ValidTo de something human readable
    cert.VaildFrom = timeToDate(cert.created);
    cert.VaildTo = timeToDate(cert.expires);
    return JSON.stringify(cert, null, 2);
}

function treatGpgCerts(certs, node) {
    let i = 0;
    const temp = document.getElementById("certtemplate");
    // Remove current contents
    while (node.lastElementChild) node.removeChild(node.lastElementChild);
    certs.forEach((cert) => {
        const pemblob = new Blob([cert.pem], { type: "application/x-x509-user-cert" });
        const url = window.URL.createObjectURL(pemblob);
        const name = cert.uid;
        const item = temp.content.cloneNode(true);
        const links = item.querySelectorAll("a");
        ml.translateHTML(item);
        let cls = "text"; // All GPG certificates can be a CA
        if (certExpired(cert.expires)) { cls = "text-danger"; }
        if (certExpiring(cert.expires)) { cls = "text-warning"; }
        item.querySelector("p").className = "my-0 " + cls;
        links[0].setAttribute("href", "#gpg" + i);
        links[1].setAttribute("href", url);
        links[2].addEventListener("click", () => { dsasCertDelete(name.replaceAll("\n", "\\n"), cert.fingerprint); });
        links[2].removeAttribute("hidden");
        item.querySelector("span").textContent = name;
        item.querySelector("div").setAttribute("id", "gpg" + i);
        item.querySelector("pre").textContent = gpgBody(cert);
        item.querySelector("pre").setAttribute("style", "height : 235x");
        node.appendChild(item);
        i += 1;
    });
}

function treatSslPubkeys(certs, node) {
    let i = 0;
    const temp = document.getElementById("certtemplate");
    // Remove current contents
    while (node.lastElementChild) node.removeChild(node.lastElementChild);
    certs.forEach((cert) => {
        const pemblob = new Blob([cert.pem], { type: "application/x-pem-file" });
        const url = window.URL.createObjectURL(pemblob);
        const { name } = cert;
        const item = temp.content.cloneNode(true);
        const links = item.querySelectorAll("a");
        ml.translateHTML(item);
        links[0].setAttribute("href", "#pubkey" + i);
        links[1].setAttribute("href", url);
        links[2].addEventListener("click", () => { dsasCertDelete(name.replaceAll("\n", "\\n"), cert.fingerprint); });
        links[2].removeAttribute("hidden");
        item.querySelector("span").textContent = name;
        item.querySelector("div").setAttribute("id", "pubkey" + i);
        item.querySelector("pre").textContent = cert.fingerprint;
        item.querySelector("pre").setAttribute("style", "height : 20x");
        node.appendChild(item);
        i += 1;
    });
}

function treatX509Certs(certs, node, added = false) {
    let i = 0;
    const temp = document.getElementById("certtemplate");
    // Remove current contents
    while (node.lastElementChild) node.removeChild(node.lastElementChild);
    certs.forEach((cert) => {
        const pemblob = new Blob([cert.pem], { type: "application/x-x509-user-cert" });
        const url = window.URL.createObjectURL(pemblob);
        const name = certName(cert);
        const item = temp.content.cloneNode(true);
        const links = item.querySelectorAll("a");
        ml.translateHTML(item);
        let cls = "text-info";
        if (certExpired(cert.validTo_time_t)) {
            cls = "text-danger";
        } else if (certExpiring(cert.validTo_time_t)) {
            cls = "text-warning";
        } else if (certIsCa(cert)) {
            cls = "text";
        }
        item.querySelector("p").className = "my-0 " + cls;
        links[0].setAttribute("href", "#" + (added ? "add" : "ca") + i);
        links[1].setAttribute("href", url);
        if (added) {
            links[2].addEventListener("click", () => { dsasCertDelete(name.replaceAll("\n", "\\n"), cert.fingerprint); });
            links[2].removeAttribute("hidden");
        }
        item.querySelector("span").textContent = name;
        item.querySelector("div").setAttribute("id", (added ? "add" : "ca") + i);
        item.querySelector("pre").textContent = certBody(cert);
        node.appendChild(item);
        i += 1;
    });
}

function dsasUploadCertCore(file, type, name) {
    const formData = new FormData();
    formData.append("op", type + "_upload");
    formData.append("file", file);
    formData.append("name", name);

    fetch("api/dsas-cert.php", {
        method: "POST",
        body: formData,
    }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modalErrors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clearFeedback();
            // Don't use location.reload here as it closes the tabs
            /* eslint-disable-next-line no-use-before-define */
            modalMessage(_("Certificate successfully sent"), () => { dsasDisplayCert("all"); }, true);
        }
    }).catch((error) => {
        if (!failLoggedin(error)) { modalMessage(_("Error : {0}", (error.message ? error.message : error))); }
    });
}
//  This needs to be exposed so test code can use it
window.dsasUploadCertCore = dsasUploadCertCore;

function dsasUploadCert(type = "x509", name = "") {
    const cert = document.getElementById(type + "upload");
    dsasUploadCertCore(cert[0].files[0], type, name);
}

function dsasPubkeyName() {
    const modalDSAS = document.getElementById("modalDSAS");
    const body = document.createElement("div");
    body.className = "col-9 d-flex justify-content-center";
    let el = body.appendChild(document.createElement("label"));
    el.setAttribute("for", "PubkeyName");
    el.textContent = _("Name :");
    el = body.appendChild(document.createElement("input"));
    el.claaName = "form-control";
    el.setAttribute("type", "text");
    el.id = "PubkeyName";
    el.addEventListener("keypress", (event) => { if (event.key === "Enter") { modalDSAS.hide(); dsasUploadCert("pubkey", document.getElementById("PubkeyName").value); } });
    modalAction(_("Enter name for public key"), () => { dsasUploadCert("pubkey", document.getElementById("PubkeyName").value); }, true);
    modalDSAS.setBody(body);
}

export default function dsasDisplayCert(what = "all") {
    fetch("api/dsas-cert.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((certs) => {
        if (what === "all" || what === "ca") { treatX509Certs(certs[0].ca, document.getElementById("ca")); }
        if (what === "all" || what === "cert") { treatX509Certs(certs[0].dsas.x509, document.getElementById("cert"), true); }
        if (what === "all" || what === "pubkey") { treatSslPubkeys(certs[0].dsas.pubkey, document.getElementById("pubkey"), true); }
        if (what === "all" || what === "gpg") { treatGpgCerts(certs[0].dsas.gpg, document.getElementById("gpg")); }
        if (what === "all") {
            document.getElementById("x509file").addEventListener("change", () => { dsasUploadCert(); });
            document.getElementById("x509add").addEventListener("click", () => { document.getElementById("x509file").click(); });
            document.getElementById("pubkeyfile").addEventListener("change", () => { dsasPubkeyName(); });
            document.getElementById("pubkeyadd").addEventListener("click", () => { document.getElementById("pubkeyfile").click(); });
            document.getElementById("gpgfile").addEventListener("change", () => { dsasUploadCert("gpg"); });
            document.getElementById("gpgadd").addEventListener("click", () => { document.getElementById("gpgfile").click(); });
        }
    }).catch((error) => {
        failLoggedin(error);
    });
}
