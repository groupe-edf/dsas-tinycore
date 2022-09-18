// The javascript used by the DSAS cert.html page
import { _, ml } from "./MultiLang";
import { modal_message, modal_errors, modal_action } from "./DsasModal";
import {
    fail_loggedin,
    clear_feedback,
    date_to_locale,
    cert_is_ca,
    cert_name,
} from "./DsasUtil";

function cert_expiring(cert) {
    // JS is time_t times 1000 'cause in milliseconds
    let tt = cert.validTo_time_t;
    tt *= 1000;

    // EDF CA has a value of -1. What does that even mean !!
    if (tt < 0) return false;
    // Expiring if less than 6 months are left
    if (tt - Date.now() < 180 * 24 * 3600000) { return true; }
    return false;
}

function cert_expired(cert) {
    const tt = cert.validTo_time_t * 1000;
    if (tt < 0) return false;
    if (tt - Date.now() < 0) { return true; }
    return false;
}

function time_t_to_date(t) {
    if (t <= 0) { return _("always"); }
    const c = new Intl.DateTimeFormat(ml.currentLanguage, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
    });
    return c.format(new Date(t * 1000));
}

function dsas_cert_real_delete(name, finger) {
    const formData = new FormData();
    formData.append("op", "delete");
    formData.append("finger", finger);
    fetch("api/dsas-cert.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modal_errors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clear_feedback();
            // Disable ESLINT here as circular refering behind the functions
            /* eslint-disable-next-line no-use-before-define */
            dsas_display_cert("cert");
            /* eslint-disable-next-line no-use-before-define */
            dsas_display_cert("pubkey");
            /* eslint-disable-next-line no-use-before-define */
            dsas_display_cert("gpg");
        }
    }).catch((error) => {
        modal_message(_("Error : {0}", (error.message ? error.message : error)));
    });
}

function dsas_cert_delete(name, finger) {
    modal_action(
        _("Delete the certificate ?<br><small>&nbsp;&nbsp;Name : {0}<br>&nbsp;&nbsp;ID : {1}</small>", name, finger.substr(0, 50)),
        () => { dsas_cert_real_delete(name, finger); },
        true,
    );
}

function cert_body(c) {
    const cert = c; // Keep eslint happy
    delete cert.pem; // Don't display the PEM file, download button for that
    // Convert ValidFrom and ValidTo de something human readable
    cert.validFrom = date_to_locale(cert.validFrom);
    cert.validTo = date_to_locale(cert.validTo);

    // Tidy up the purposes, which I find ugly for the PHP openssl_x509_parse function
    const purposes = [];
    Object.keys(cert.purposes).forEach((key) => { purposes.push(cert.purposes[key][2]); });
    cert.purposes = purposes;

    return JSON.stringify(cert, null, 2);
}

function gpg_body(c) {
    const cert = c;
    delete cert.pem; // Don't display the PEM file, download button for that
    // Convert ValidFrom and ValidTo de something human readable
    cert.VaildFrom = time_t_to_date(cert.created);
    cert.VaildTo = time_t_to_date(cert.expires);
    return JSON.stringify(cert, null, 2);
}

function treat_gpg_certs(certs, node) {
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
        let cls = "text-info";
        if (cert_expired(cert)) { cls = "text-danger"; }
        if (cert_expiring(cert)) { cls = "text-warning"; }
        item.querySelector("p").className = "my-0 " + cls;
        links[0].setAttribute("href", "#gpg" + i);
        links[1].setAttribute("href", url);
        links[2].addEventListener("click", () => { dsas_cert_delete(name.replaceAll("\n", "\\n"), cert.fingerprint); });
        links[2].removeAttribute("hidden");
        item.querySelector("span").textContent = name;
        item.querySelector("div").setAttribute("id", "gpg" + i);
        item.querySelector("pre").textContent = gpg_body(cert);
        item.querySelector("pre").setAttribute("style", "height : 235x");
        node.appendChild(item);
        i += 1;
    });
}

function treat_ssl_pubkeys(certs, node) {
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
        links[0].setAttribute("href", "#pubkey" + i);
        links[1].setAttribute("href", url);
        links[2].addEventListener("click", () => { dsas_cert_delete(name.replaceAll("\n", "\\n"), cert.fingerprint); });
        links[2].removeAttribute("hidden");
        item.querySelector("span").textContent = name;
        item.querySelector("div").setAttribute("id", "pubkey" + i);
        item.querySelector("pre").textContent = cert.fingerprint;
        item.querySelector("pre").setAttribute("style", "height : 20x");
        node.appendChild(item);
        i += 1;
    });
}

function treat_x509_certs(certs, node, added = false) {
    let i = 0;
    const temp = document.getElementById("certtemplate");
    // Remove current contents
    while (node.lastElementChild) node.removeChild(node.lastElementChild);
    certs.forEach((cert) => {
        const pemblob = new Blob([cert.pem], { type: "application/x-x509-user-cert" });
        const url = window.URL.createObjectURL(pemblob);
        const name = cert_name(cert);
        const item = temp.content.cloneNode(true);
        const links = item.querySelectorAll("a");
        let cls = "text-info";
        if (cert_expired(cert)) {
            cls = "text-danger";
        } else if (cert_expiring(cert)) {
            cls = "text-warning";
        } else if (cert_is_ca(cert)) {
            cls = "text";
        }
        item.querySelector("p").className = "my-0 " + cls;
        links[0].setAttribute("href", "#" + (added ? "add" : "ca") + i);
        links[1].setAttribute("href", url);
        if (added) {
            links[2].addEventListener("click", () => { dsas_cert_delete(name.replaceAll("\n", "\\n"), cert.fingerprint); });
            links[2].removeAttribute("hidden");
        }
        item.querySelector("span").textContent = name;
        item.querySelector("div").setAttribute("id", (added ? "add" : "ca") + i);
        item.querySelector("pre").textContent = cert_body(cert);
        node.appendChild(item);
        i += 1;
    });
}

function dsas_upload_cert_core(file, type, name) {
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
            modal_errors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clear_feedback();
            // Don't use location.reload here as it closes the tabs
            /* eslint-disable-next-line no-use-before-define */
            modal_message(_("Certificate successfully sent"), () => { dsas_display_cert("all"); }, true);
        }
    }).catch((error) => {
        if (!fail_loggedin(error)) { modal_message(_("Error : {0}", (error.message ? error.message : error))); }
    });
}
//  This needs to be exposed so test code can use it
window.dsas_upload_cert_core = dsas_upload_cert_core;

function dsas_upload_cert(type = "x509", name = "") {
    const cert = document.getElementById(type + "upload");
    dsas_upload_cert_core(cert[0].files[0], type, name);
}

function dsas_pubkey_name() {
    const modalDSAS = document.getElementById("modalDSAS");
    let body = "";
    modal_action(_("Enter name for public key"), () => { dsas_upload_cert("pubkey", document.getElementById("PubkeyName").value); }, true);
    body = "    <div class=\"col-9 d-flex justify-content-center\">\n"
         + "      <label for=\"PubkeyName\">" + _("Name :") + "</label>\n"
         + "      <input type=\"text\" id=\"PubkeyName\" value=\"\" class=\"form-control\">\n"
         + "    </div>";
    modalDSAS.setAttribute("body", body);
    document.getElementById("PubkeyName").addEventListener("keypress", (event) => { if (event.key === "Enter") { modalDSAS.hide(); dsas_upload_cert("pubkey", document.getElementById("PubkeyName").value); } });
}

export default function dsas_display_cert(what = "all") {
    fetch("api/dsas-cert.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((certs) => {
        if (what === "all" || what === "ca") { treat_x509_certs(certs[0].ca, document.getElementById("ca")); }
        if (what === "all" || what === "cert") { treat_x509_certs(certs[0].dsas.x509, document.getElementById("cert"), true); }
        if (what === "all" || what === "pubkey") { treat_ssl_pubkeys(certs[0].dsas.pubkey, document.getElementById("pubkey"), true); }
        if (what === "all" || what === "gpg") { treat_gpg_certs(certs[0].dsas.gpg, document.getElementById("gpg")); }
        if (what === "all") {
            document.getElementById("x509file").addEventListener("change", () => { dsas_upload_cert(); });
            document.getElementById("x509add").addEventListener("click", () => { document.getElementById("x509file").click(); });
            document.getElementById("pubkeyfile").addEventListener("change", () => { dsas_pubkey_name(); });
            document.getElementById("pubkeyadd").addEventListener("click", () => { document.getElementById("pubkeyfile").click(); });
            document.getElementById("gpgfile").addEventListener("change", () => { dsas_upload_cert("gpg"); });
            document.getElementById("gpgadd").addEventListener("click", () => { document.getElementById("gpgfile").click(); });
        }
    }).catch((error) => {
        fail_loggedin(error);
    });
}
