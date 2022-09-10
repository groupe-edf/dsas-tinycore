// The javascript used by the DSAS cert.html page

/* globals _ modal_message modal_errors modal_action clear_feedback */
/* globals fail_loggedin cert_is_ca cert_name */

function cert_expiring(cert) {
    // JS is time_t times 1000 'cause in milliseconds
    let tt = cert.validTo_time_t;
    tt *= 1000;

    // EDF CA has à value of -1. What does that even mean !!
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

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function time_t_to_date(t) {
    if (t <= 0) { return _("always"); }

    const d = new Date(t * 1000);
    return d.toUTCString();
}

function date_to_str(d) {
    // Example : Convert '170131235959Z' to '31 jan 2017 23:58:59. Asume always "Z" = UTC
    return d.substr(4, 2) + " " + ["jan", "f&eacute;v", "mar", "avr", "mai", "jun", "jul",
        "aou", "sep", "oct", "nov", "d&eacute;c"][Number(d.substr(2, 2)) - 1] + " 20"
      + d.substr(0, 2) + " " + d.substr(6, 2) + ":" + d.substr(8, 2) + ":" + d.substr(10, 2) + " UTC";
}

function cert_body(c) {
    const cert = c; // Keep eslint happy
    delete cert.pem; // Don't display the PEM file, download button for that
    // Convert ValidFrom and ValidTo de something human readable
    cert.validFrom = date_to_str(cert.validFrom);
    cert.validTo = date_to_str(cert.validTo);

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

function treat_gpg_certs(certs) {
    let body = "";
    let i = 0;
    certs.forEach((cert) => {
        const pemblob = new Blob([cert.pem], { type: "application/x-x509-user-cert" });
        const url = window.URL.createObjectURL(pemblob);
        const name = cert.uid;
        let cls = "text";
        if (cert_expired(cert)) { cls = "text-danger"; }
        if (cert_expiring(cert)) { cls = "text-warning"; }

        body = body
      + "<p class=\"my-0 " + cls + "\"><a class=\"text-toggle\" data-bs-toggle=\"collapse\" href=\"#gpg" + i + "\" role=\"button\""
      + "aria-controls=\"gpg" + i + "\" aria-expanded=\"false\">"
      + "<i class=\"text-collapsed\"><img src=\"caret-right.svg\"/></i>"
      + "<i class=\"text-expanded\"><img src=\"caret-down.svg\"/></i></a>" + escapeHtml(name)
      + "&nbsp;<a data-toggle=\"tooltip\" title=\"" + _("Download") + "\" href=\"" + url + "\" download=\"" + name.replace(/ /g, "_") + ".gpg\">"
      + "<img src=\"save.svg\"></a>";
        body = body + "&nbsp;<a data-toggle=\"tooltip\" title=\"" + _("Delete") + "\" onclick=\"dsas_cert_delete('" + name.replaceAll("\n", "\\n") + "','"
        + cert.fingerprint + "');\"><img src=\"x-lg.svg\"></a>";
        body = body
      + "</p><div class=\"collapse\" id=\"gpg" + i + "\"><div class=\"card card-body\">"
      + "<pre style=\"height : 210px\">" + gpg_body(cert) + "</pre></div></div>\n";
        i += 1;
    });
    return body;
}

function treat_ssl_pubkeys(pubkeys) {
    let body = "";
    let i = 0;
    pubkeys.forEach((pubkey) => {
        const pemblob = new Blob([pubkey.pem], { type: "application/x-pem-file" });
        const url = window.URL.createObjectURL(pemblob);
        const { name } = pubkey;
        body = body
      + "<p class=\"my-0\"><a class=\"text-toggle\" data-bs-toggle=\"collapse\" href=\"#pubkey" + i + "\" role=\"button\""
      + "aria-controls=\"pubkey" + i + "\" aria-expanded=\"false\">"
      + "<i class=\"text-collapsed\"><img src=\"caret-right.svg\"/></i>"
      + "<i class=\"text-expanded\"><img src=\"caret-down.svg\"/></i></a>" + name
      + "&nbsp;<a data-toggle=\"tooltip\" title=\"" + _("Download") + "\" href=\"" + url + "\" download=\"" + name.replace(/ /g, "_") + ".pem\">"
      + "<img src=\"save.svg\"></a>";
        body = body + "&nbsp;<a data-toggle=\"tooltip\" title=\"" + _("Delete") + "\" onclick=\"dsas_cert_delete('" + name.replaceAll("\n", "\\n") + "','"
        + pubkey.fingerprint + "');\"><img src=\"x-lg.svg\"></a>";
        body = body
      + "</p><div class=\"collapse\" id=\"pubkey" + i + "\"><div class=\"card card-body\">"
      + "<pre style=\"height : 20px\">fingerprint : " + pubkey.fingerprint + "</pre></div></div>\n";
        i += 1;
    });
    return body;
}

function treat_x509_certs(certs, added = false) {
    let body = "";
    let i = 0;
    certs.forEach((cert) => {
        const pemblob = new Blob([cert.pem], { type: "application/x-x509-user-cert" });
        const url = window.URL.createObjectURL(pemblob);
        const name = cert_name(cert);
        let cls = "text";
        if (cert_expired(cert)) { cls = "text-danger"; }
        if (cert_expiring(cert)) { cls = "text-warning"; }
        if (cert_is_ca(cert)) { cls = "text-info"; }

        body = body
      + "<p class=\"my-0 " + cls + "\"><a class=\"text-toggle\" data-bs-toggle=\"collapse\" href=\"#" + (added ? "add" : "ca") + i + "\" role=\"button\""
      + "aria-controls=\"ca" + i + "\" aria-expanded=\"false\">"
      + "<i class=\"text-collapsed\"><img src=\"caret-right.svg\"/></i>"
      + "<i class=\"text-expanded\"><img src=\"caret-down.svg\"/></i></a>" + name
      + "&nbsp;<a data-toggle=\"tooltip\" title=\"" + _("Download") + "\" href=\"" + url + "\" download=\"" + name.replace(/ /g, "_") + ".crt\">"
      + "<img src=\"save.svg\"></a>";
        if (added) {
            body = body + "&nbsp;<a data-toggle=\"tooltip\" title=\"" + _("Delete") + "\" onclick=\"dsas_cert_delete('" + name.replaceAll("\n", "\\n") + "','"
        + cert.fingerprint + "');\"><img src=\"x-lg.svg\"></a>";
        }
        body = body
      + "</p><div class=\"collapse\" id=\"" + (added ? "add" : "ca") + i + "\"><div class=\"card card-body\">"
      + "<pre style=\"height : 300px\">" + cert_body(cert) + "</pre></div></div>\n";
        i += 1;
    });
    return body;
}

export default function dsas_display_cert(what = "all") {
    fetch("api/dsas-cert.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((certs) => {
        if (what === "all" || what === "ca") { document.getElementById("ca").innerHTML = treat_x509_certs(certs[0].ca); }
        if (what === "all" || what === "cert") { document.getElementById("cert").innerHTML = treat_x509_certs(certs[0].dsas.x509, true); }
        if (what === "all" || what === "pubkey") { document.getElementById("pubkey").innerHTML = treat_ssl_pubkeys(certs[0].dsas.pubkey, true); }
        if (what === "all" || what === "gpg") { document.getElementById("gpg").innerHTML = treat_gpg_certs(certs[0].dsas.gpg); }
    }).catch((error) => {
        fail_loggedin(error.statusText);
    });
}
window.dsas_display_cert = dsas_display_cert;

export function dsas_cert_delete(name, finger) {
    modal_action(
        _("Delete the certificate ?<br><small>&nbsp;&nbsp;Name : {0}<br>&nbsp;&nbsp;ID : {1}</small>", name, finger.substr(0, 50)),
        "dsas_cert_real_delete('" + name + "','" + finger + "');",
        true,
    );
}
window.dsas_cert_delete = dsas_cert_delete;

export function dsas_cert_real_delete(name, finger) {
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
            dsas_display_cert("cert");
            dsas_display_cert("pubkey");
            dsas_display_cert("gpg");
        }
    }).catch((error) => {
        modal_message(_("Error : {0}", (error.statusText ? error.statusText : error)));
    });
}
window.dsas_cert_real_delete = dsas_cert_real_delete;

export function dsas_pubkey_name() {
    const modalDSAS = document.getElementById("modalDSAS");
    let body = "";
    modal_action(_("Enter name for public key"), "dsas_upload_cert(\"pubkey\", document.getElementById(\"PubkeyName\").value);", true);
    body = "    <div class=\"col-9 d-flex justify-content-center\">\n"
         + "      <label for=\"PubkeyName\">" + _("Name :") + "</label>\n"
         + "      <input type=\"text\" id=\"PubkeyName\" value=\"\" class=\"form-control\" onkeypress=\"if (event.key === 'Enter'){ modalDSAS.hide(); dsas_upload_cert('pubkey', document.getElementById('PubkeyName').value);}\">\n"
         + "    </div>";
    modalDSAS.setAttribute("body", body);
}
window.dsas_pubkey_name = dsas_pubkey_name;

export function dsas_upload_cert_core(file, type, name) {
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
            modal_message(_("Certificate successfully sent"), "dsas_display_cert();", true);
        }
    }).catch((error) => {
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error : {0}", (error.statusText ? error.statusText : error))); }
    });
}
window.dsas_upload_cert_core = dsas_upload_cert_core;

export function dsas_upload_cert(type = "x509", name = "") {
    const cert = document.getElementById(type + "upload");
    dsas_upload_cert_core(cert[0].files[0], type, name);
}
window.dsas_upload_cert = dsas_upload_cert;
