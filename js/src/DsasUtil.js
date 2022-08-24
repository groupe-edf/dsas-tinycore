// DSAS utility functions used almost everywhere
import "bootstrap/dist/css/bootstrap.min.css";
import "./dsas.css";
import "./github-markdown.min.css";
import "bootstrap";

// These function are in another file
/* globals MultiLang modal_message modal_action modal_errors */

// Timeout variable
let timeoutLogin = 0;

// Global ml variable for the translation.
// Use "translateHTML" to force translation of the page. Only elements
// with the "data-i18n" property are translated.
const ml = new MultiLang(
    "languages.json",
    (() => {
        // Force reload of header as it might have already been rendered
        document.getElementsByTagName("dsas-header").forEach((head) => { head.render(); });
        ml.translateHTML();
    }),
    (() => {
        document.getElementsByTagName("dsas-header").forEach((head) => head.render());
        if ((window.location.pathname === "help.html")
                || (window.location.pathname === "/help.html")) {
            // Special case for help.html
            window.location = "help.html?language=" + this.currentLanguage;
        } else {
            window.location.reload();
        }
    }),
);

// Use "_" as the function name here to be like in python i18n
function _(...args) {
    return ml.translate(...args);
}

// Many following functions are used elsewhere just not here. Shut eslint up
// eslint-disable-next-line no-unused-vars
function cert_name(cert) {
    if (cert.subject.CN) { return cert.subject.CN; }
    if (cert.subject.OU) { return cert.subject.OU; }
    if (cert.subject.O) { return cert.subject.O; }
    if (cert.extensions.subjectKeyIdentifier) { return cert.extensions.subjectKeyIdentifier; }
    return "name";
}

function empty_obj(obj) {
    if (!obj || Object.keys(obj).length === 0 || obj === "undefined") { return true; }
    return false;
}

// eslint-disable-next-line no-unused-vars
function print_obj(obj) {
    return (empty_obj(obj) ? "" : _(obj));
}

// eslint-disable-next-line no-unused-vars
function date_to_locale(d) {
    if (d === "never") { return _("never"); }
    const c = new Intl.DateTimeFormat(ml.currentLanguage, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
    });
    if (typeof (d) === "string") {
        return c.format(new Date(d.substr(0, 4) + "-" + d.substr(4, 2) + "-" + d.substr(6, 2) + "T"
           + d.substr(8, 2) + ":" + d.substr(10, 2) + ":" + d.substr(12, 2) + "Z"));
    }
    const ret = [];
    d.forEach((d2) => {
        ret.push(c.format(new Date(d2.substr(0, 4) + "-" + d2.substr(4, 2) + "-" + d2.substr(6, 2) + "T"
           + d2.substr(8, 2) + ":" + d2.substr(10, 2) + ":" + d2.substr(12, 2) + "Z")));
    });
    return ret;
}

// eslint-disable-next-line no-unused-vars
function clear_feedback() {
    // eslint-disable-next-line no-param-reassign
    document.getElementsByClassName("invalid-feedback").forEach((feed) => { feed.innerHTML = ""; });
    document.getElementsByClassName("form-control").forEach((feed) => { feed.setAttribute("class", "form-control"); });
}

function dsas_origin() {
    // Can't just use window.location.origin as we might be wrapped in a WebSSL portal
    const s = String(window.location);
    return s.substring(0, s.lastIndexOf("/") + 1);
}

export function dsas_loggedin(update_timeout = true, is_admin = true) {
    const uri = new URL("api/login.php", dsas_origin());
    uri.search = new URLSearchParams({ timeout: update_timeout, admin: is_admin });
    fetch(uri).then((response) => {
        if (!response.ok) { return Promise.reject(new Error(response.statusText)); }
        // Check if logged in once every 15 seconds, but don't update the timeout
        if (timeoutLogin !== 0) { clearTimeout(timeoutLogin); }
        timeoutLogin = setTimeout(dsas_loggedin, 15000, false, is_admin);
        return response.text();
    }).catch(() => {
        modal_message(
            _("You are not connected. Click 'Ok' to reconnect."),
            "window.location='login.html'",
        );
    });
}
window.dsas_loggedin = dsas_loggedin;

function fail_loggedin(status) {
    if (status === "Forbidden") {
        modal_message(
            _("You are not connected. Click 'Ok' to reconnect."),
            "window.location='login.html'",
        );
        return true;
    } return false;
}

export function dsas_check_warnings(disablenav = false, redirect = true) {
    fetch("api/dsas-users.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((obj) => {
        if ((obj.first === "true") && redirect) { window.location = "passwd.html"; }
    }).catch((error) => {
        fail_loggedin(error.statusText);
    });

    fetch("api/dsas-get-warning.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((obj) => {
        if (obj !== null) {
            let warn = "";
            let error = "";
            let body = "";
            obj.forEach((line) => {
                if (line.type === "warn") {
                    warn += "<p>" + _(line.msg);
                } else {
                    error += "<p>" + _(line.msg) + "</p>\n";
                }
            });
            if (error) {
                if (disablenav) { document.getElementsByTagName("dsas-header")[0].setAttribute("disablenav", "disabled"); }
                body += "<p class=\"text-danger\">" + error + "</p>";
            }
            if (warn) { body += "<p class=\"text-warning\">" + warn + "</p>"; }
            if (body) { modal_message(body); }
        }
    }).catch((error) => {
        fail_loggedin(error.statusText);
    });
}
window.dsas_check_warnings = dsas_check_warnings;

// eslint-disable-next-line no-unused-vars
function cert_is_ca(cert) {
    if (!cert.extensions.authorityKeyIdentifier
            || cert.extensions.authorityKeyIdentifier
                .indexOf(cert.extensions.subjectKeyIdentifier) >= 0) { return true; }
    return false;
}

function b64toBlob(b64Data, contentType = "", sliceSize = 512) {
    const byteChar = atob(b64Data);
    const byteArray = [];

    for (let offset = 0; offset < byteChar.length; offset += sliceSize) {
        const slice = byteChar.slice(offset, offset + sliceSize);

        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i += 1) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        const ba = new Uint8Array(byteNumbers);
        byteArray.push(ba);
    }

    const blob = new Blob(byteArray, { type: contentType });
    return blob;
}

export function dsas_apply() {
    const modalApply = document.getElementById("modalDSAS");
    modalApply.setAttribute("disable", true);
    modalApply.setAttribute("body", "<span class='spinner-border spinner-border-sm'></span> &nbsp; Sauvegarde de la configuration en cours.");

    fetch("api/save.php").then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then(() => {
        modalApply.setAttribute("body", "<span class='spinner-border spinner-border-sm'></span> &nbsp; Application de la configuration en cours.");
        fetch("api/apply.php").then((response) => {
            if (response.ok) { return response.text(); }
            return Promise.reject(new Error(response.statusText));
        }).then(() => {
            modalApply.removeAttribute("disable");
            modalApply.removeAttribute("body");
            modalApply.hide();
            modal_message(_("Configuration applied"));
        }).catch(() => {
            modalApply.removeAttribute("disable");
            modalApply.removeAttribute("body");
            modalApply.hide();
            modal_message(_("Error during application of the configuration"));
        });
    }).catch((error) => {
        modalApply.removeAttribute("disable");
        modalApply.removeAttribute("body");
        modalApply.hide();
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error during save of the configuration")); }
    });
}
window.dsas_apply = dsas_apply;

export function dsas_real_backup() {
    const passwd = document.getElementById("BackupPassword").value;
    const uri = new URL("api/backup.php", dsas_origin());
    uri.search = new URLSearchParams({ passwd });
    fetch(uri).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((backup) => {
        const saveBase64 = (() => {
            const a = document.createElement("a");
            document.body.appendChild(a);
            a.style = "display: none";
            return function _backup(data, name) {
                const backupblob = b64toBlob(data, "application/gzip");
                const backupurl = window.URL.createObjectURL(backupblob);
                a.href = backupurl;
                a.download = name;
                a.click();
                window.URL.revokeObjectURL(backupurl);
            };
        });
        saveBase64(backup, "dsas_backup.tgz");
    }).catch((error) => {
        // Don't translate error.statusText here
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error : {0}", (error.statusText ? error.statusText : error))); }
    });
}
window.dsas_real_backup = dsas_real_backup;

export function dsas_backup() {
    const modalDSAS = document.getElementById("modalDSAS");
    let body = "";
    modal_action(_("Backup the DSAS configuration"), "dsas_real_backup();", true);
    body = "    <div class=\"col-9 d-flex justify-content-center\">\n"
         + "      <label for=\"BackupPassword\">" + _("Backup password :") + "</label>\n"
         + "      <input type=\"password\" id=\"BackupPassword\" value=\"\" class=\"form-control\" onkeypress=\"if (event.key === 'Enter'){ modalDSAS.hide(); dsas_real_backup();}\">\n"
         + "    </div>";
    modalDSAS.setAttribute("body", body);
}
window.dsas_backup = dsas_backup;

export function dsas_passwd_restore() {
    const modalDSAS = document.getElementById("modalDSAS");
    let body = "";
    modal_action(_("Restoration of the DSAS configuration"), "dsas_real_restore();", true);
    body = "    <div class=\"col-9 d-flex justify-content-center\">\n"
         + "      <label for=\"RestorePassword\">" + _("Restoration password :") + "</label>\n"
         + "      <input type=\"password\" id=\"RestorePassword\" value=\"\" class=\"form-control\" onkeypress=\"if (event.key === 'Enter') {modalDSAS.hide(); dsas_real_restore();}\">\n"
         + "    </div>";
    modalDSAS.setAttribute("body", body);
}
window.dsas_passwd_restore = dsas_passwd_restore;

export function dsas_restore() {
    const inp = document.createElement("input");
    document.body.appendChild(inp);
    inp.style = "display: none";
    inp.type = "file";
    inp.accept = "application/gzip";
    inp.id = "RestoreSelectFile";
    inp.addEventListener("change", dsas_passwd_restore, true);
    inp.click();
}
window.dsas_restore = dsas_restore;

export function dsas_restore_core(file, passwd = "") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("passwd", passwd);

    fetch("api/backup.php", {
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
        // Can't apply directly from the restore script as the application
        // might restart the web server. Need to use use apply JS function
        // dsas_apply with a pre setup modal
            const modalDSAS = document.getElementById("modalDSAS");
            modalDSAS.removeAttribute("disable");
            modalDSAS.removeAttribute("body");
            modalDSAS.removeAttribute("size");
            modalDSAS.removeAttribute("hideonclick");
            modalDSAS.setAttribute("action", "");
            modalDSAS.setAttribute("title", _("Apply the configuration"));
            modalDSAS.setAttribute("type", "Ok");
            modalDSAS.show();
            dsas_apply();
        }
    }).catch((error) => {
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error : {0}", (error.statusText ? error.statusText : error))); }
    });
}
window.dsas_restore_core = dsas_restore_core;

export function dsas_real_restore() {
    const passwd = document.getElementById("RestorePassword").value;
    const file = document.getElementById("RestoreSelectFile").files[0];
    dsas_restore_core(file, passwd);
}
window.dsas_real_restore = dsas_real_restore;

function chkdown(site) {
    const times = 5;
    const progress = document.getElementById("progressShutdown");

    return new Promise((response, reject) => {
        (function recurse(s, i) {
            let c = i;
            // favicon because its small and Math.random to avoid the cache
            fetch(s + "/favicon.ico?rand=" + Math.random()).then((r) => {
                if (c === 30) { return reject(r); }

                c += 1;
                const prog = ((c + 5) * 100) / 30;
                progress.setAttribute("style", "width: " + prog + "%");
                progress.setAttribute("aria-valuenow", prog);
                return setTimeout(() => recurse(s, c), 1000);
            }).catch((err) => {
                // Machine is down return success
                response(err);
            });
        }(site, times));
    });
}

function chkup(site) {
    const times = 5;
    const progress = document.getElementById("progressReboot");

    return new Promise((response, reject) => {
        (function recurse(s, i) {
            let c = i;
            // favicon because its small and Math.random to avoid the cache
            fetch(s + "/favicon.ico?rand=" + Math.random()).then((r) => {
                // Machine is up. Return success
                response(r);
            }).catch((err) => {
                if (c === 30) { return reject(err); }
                c += 1;
                const prog = ((i + 5) * 100) / 30;
                progress.setAttribute("style", "width: " + prog + "%");
                progress.setAttribute("aria-valuenow", prog);
                return setTimeout(() => recurse(s, c), 1000);
            });
        }(site, times));
    });
}

function waitreboot(c = 0) {
    const modalReboot = document.getElementById("modalDSAS");
    const progress = document.getElementById("progressReboot");
    const counter = c + 1;

    if (counter < 5) {
    // Wait 5 seconds till testing if up
        const prog = (counter * 100) / 30;
        progress.setAttribute("style", "width: " + prog + "%");
        progress.setAttribute("aria-valuenow", prog);
        setTimeout(waitreboot, 1000, counter);
    } else {
        chkup(window.location.host).then(() => {
            window.location = "login.html";
        }).catch(() => {
            modalReboot.removeAttribute("disable");
            modalReboot.hide();
            modal_message(_("Timeout during restart"));
        });
    }
}

function waitshutdown(c = 0) {
    const modalShutdown = document.getElementById("modalDSAS");
    const progress = document.getElementById("progressShutdown");
    const counter = c + 1;

    if (counter < 5) {
    // Wait 5 seconds till testing if down
        const prog = (counter * 100) / 30;
        progress.setAttribute("style", "width: " + prog + "%");
        progress.setAttribute("aria-valuenow", prog);
        setTimeout(waitshutdown, 1000, counter);
    } else {
        chkdown(window.location.host).then(() => {
            modalShutdown.removeAttribute("disable");
            modalShutdown.hide();
            modal_message(_("The DSAS has shutdown. You can close this window"));
        }).catch(() => {
            modalShutdown.removeAttribute("disable");
            modalShutdown.hide();
            modal_message(_("Timeout during shutdown"));
        });
    }
}

export function dsas_reboot() {
    const modalReboot = document.getElementById("modalDSAS");
    modalReboot.setAttribute("disable", true);
    modalReboot.setAttribute("body", "  <div class=\"row\">\n"
                 + "    <div class=\"col-8\">\n"
                 + "      <span class=\"spinner-border spinner-border-sm\"></span>&nbsp;" + _("Rebooting the DSAS")
                 + "    </div>"
                 + "    <div class=\"col-4\">"
                 + "      <div class=\"progress\">"
                 + "        <div class=\"progress-bar\" id=\"progressReboot\" role=\"progressbar\" style=\"\" aria-valuenow=\"\" araia-valuemin=\"0\" aria-valuemax=\"100\"></div>"
                 + "      </div>\n"
                 + "    </div>\n"
                 + "  </div>");

    // Clear status and login timeouts before continuing
    if (timeoutLogin !== 0) { clearTimeout(timeoutLogin); }

    fetch("api/reboot.php").then((response) => {
        if (response.ok) { setTimeout(waitreboot, 1000); }
        return Promise.reject(new Error(response.statusText));
    }).catch((error) => {
        modalReboot.removeAttribute("disable");
        modalReboot.hide();
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error during reboot")); }
    });
}
window.dsas_reboot = dsas_reboot;

export function dsas_shutdown() {
    const modalShutdown = document.getElementById("modalDSAS");

    modalShutdown.setAttribute("disable", true);
    modalShutdown.setAttribute("body", "  <div class=\"row\">\n"
                 + "    <div class=\"col-8\">\n"
                 + "      <span class=\"spinner-border spinner-border-sm\"></span> &nbsp;" + _("Shutting down the DSAS")
                 + "    </div>"
                 + "    <div class=\"col-4\">"
                 + "      <div class=\"progress\">"
                 + "        <div class=\"progress-bar\" id=\"progressShutdown\" role=\"progressbar\" style=\"\" aria-valuenow=\"\" araia-valuemin=\"0\" aria-valuemax=\"100\"></div>"
                 + "      </div>\n"
                 + "    </div>\n"
                 + "  </div>");

    // Clear status and login timeouts before continuing
    if (timeoutLogin !== 0) { clearTimeout(timeoutLogin); }

    fetch("api/shutdown.php").then((response) => {
        if (response.ok) { return setTimeout(waitshutdown, 1000); }
        return Promise.reject(new Error(response.statusText));
    }).catch((error) => {
        modalShutdown.removeAttribute("disable");
        modalShutdown.hide();
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error during shutdown")); }
    });
}
window.dsas_shutdown = dsas_shutdown;

export function dsas_logout() {
    // No error checking because, only possible error is that already logged out
    fetch("api/logout.php").then(() => {
        window.location.href = "login.html";
    }).catch(() => { window.location.href = "login.html"; });
}
window.dsas_logout = dsas_logout;

class DSASHeader extends HTMLElement {
    connectedCallback() {
        if (!this.rendered) {
            this.render();
            this.rendered = true;
        }
    }

    render() {
        const disablenav = this.getAttribute("disablenav");

        this.innerHTML = "    <div class=\"row g-0 sticky-top\"><div class=\"col-8\"><nav class=\"navbar navbar-expand-sm bg-dark navbar-dark\">\n"
        + "      <a class=\"navbar-brand px-2\"" + ((disablenav !== "disabled") ? " href=\"/" : "") + "\">DSAS</a>\n"
        + "      <ul class=\"navbar-nav\">\n"
        + "      <li class=\"nav-item dropdown\">\n"
        + "        <a class=\"nav-link " + disablenav + " dropdown-toggle\" data-bs-toggle=\"dropdown\">\n"
        + "        " + _("Configuration") + "\n"
        + "        </a>\n"
        + "        <div class=\"dropdown-menu\">\n"
        + "          <a class=\"dropdown-item\" href=\"tasks.html\">" + _("Tasks") + "</a>\n"
        + "          <a class=\"dropdown-item\" href=\"cert.html\">" + _("Certificates") + "</a>\n"
        + "          <a class=\"dropdown-item\" href=\"service.html\">" + _("Services") + "</a>\n"
        + "          <a class=\"dropdown-item\" href=\"net.html\">" + _("Network") + "</a>\n"
        + "          <a class=\"dropdown-item\" href=\"web.html\">" + _("Web") + "</a>\n"
        + "        </div>\n"
        + "      </li>\n"
        + "      <li class=\"nav-item dropdown\">\n"
        + "        <a class=\"nav-link dropdown-toggle\" data-bs-toggle=\"dropdown\">\n"
        + "        " + _("System") + "\n"
        + "        </a>\n"
        + "        <div class=\"dropdown-menu\">\n"
        + "          <a class=\"dropdown-item\" href=\"users.html\">" + _("Users") + "</a>\n"
        + "          <a class=\"dropdown-item " + disablenav + "\" onclick=\"dsas_backup();\">" + _("Backup") + "</a>\n"
        + "          <a class=\"dropdown-item\" onclick=\"dsas_restore();\">" + _("Restore") + "</a>\n"
        + "          <a class=\"dropdown-item " + disablenav + "\" onclick=\"modal_action('" + _("Are you sure you want to restart ?") + "', 'dsas_reboot();')\">" + _("Restart") + "</a>\n"
        + "          <a class=\"dropdown-item " + disablenav + "\" onclick=\"modal_action('" + _("Are you sure you want to shutdown ?") + "', 'dsas_shutdown();')\">" + _("Shutdown") + "</a>\n"
        + "          <a class=\"dropdown-item " + disablenav + "\" onclick=\"modal_action('" + _("Are you sure you want to logout ?") + "', 'dsas_logout();', true)\">" + _("Logout") + "</a>\n"
        + "        </div>\n"
        + "      </li>\n"
        + "      <li class=\"nav-item\">\n"
        + "        <a class=\"nav-link " + disablenav + "\" href=\"help.html" + (ml.currentLanguage ? "?language=" + ml.currentLanguage : "") + "\">" + _("Documentation") + "</a>\n"
        + "      </li>\n"
        + "      </ul>\n"
        + "    </nav></div>"
        + "    <div class=\"col-4\"><nav class=\"navbar navbar-expand-sm bg-dark navbar-dark\">\n"
        + "      <ul class=\"navbar-nav ms-auto\">\n"
        + "      <span data-i18n-navbar-lang></span>\n"
        + "      <li class=\"nav-item px-2\">\n"
        + "        <a class=\"nav-link " + disablenav + " btn btn-sm btn-danger\" onclick=\"modal_action('" + _("Are you sure you want to apply ?") + "', 'dsas_apply();')\">" + _("Apply") + "</a>\n"
        + "      </li>\n"
        + "      </ul>\n"
        + "    </nav></div></div>"
        + "    <dsas-modal id=\"modalDSAS\" tag=\"DSAS\"  type=\"Ok\"></dsas-modal>\n";
    }

    static get observedAttributes() {
        return ["disablenav"];
    }

    attributeChangedCallback() {
        this.render();
    }
}

customElements.define("dsas-header", DSASHeader);
