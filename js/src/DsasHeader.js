// DSAS functions used in the page header
import { ml, _ } from "./MultiLang";
import { modal_message, modal_action, modal_errors } from "./DsasModal";
import { fail_loggedin, dsas_origin, clearTimeoutLogin } from "./DsasUtil";

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
// This needed to be exposed so test code can use it
window.b64toBlob = b64toBlob;

function dsas_apply() {
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
        if (!fail_loggedin(error)) { modal_message(_("Error during save of the configuration")); }
    });
}
window.dsas_apply = dsas_apply;

function dsas_real_backup() {
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
        })();
        saveBase64(backup, "dsas_backup.tgz");
    }).catch((error) => {
        if (!fail_loggedin(error)) { modal_message(_("Error : {0}", (error.message ? error.message : error))); }
    });
}
// This needs to be exposed so test code can use it
window.dsas_real_backup = dsas_real_backup;

function dsas_backup() {
    const modalDSAS = document.getElementById("modalDSAS");
    let body = "";
    modal_action(_("Backup the DSAS configuration"), () => { dsas_real_backup(); }, true);
    body = "    <div class=\"col-9 d-flex justify-content-center\">\n"
         + "      <label for=\"BackupPassword\">" + _("Backup password :") + "</label>\n"
         + "      <input type=\"password\" id=\"BackupPassword\" value=\"\" class=\"form-control\" onkeypress=\"if (event.key === 'Enter'){ modalDSAS.hide(); dsas_real_backup();}\">\n"
         + "    </div>";
    modalDSAS.setAttribute("body", body);
}
window.dsas_backup = dsas_backup;

function dsas_passwd_restore() {
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

function dsas_restore() {
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

export default function dsas_restore_core(file, passwd = "") {
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
            modalDSAS.setAction();
            modalDSAS.setAttribute("title", _("Apply the configuration"));
            modalDSAS.setAttribute("type", "Ok");
            modalDSAS.show();
            dsas_apply();
        }
    }).catch((error) => {
        if (!fail_loggedin(error)) { modal_message(_("Error : {0}", (error.message ? error.message : error))); }
    });
}
window.dsas_restore_core = dsas_restore_core;

function dsas_real_restore() {
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

function dsas_reboot() {
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

    // Clear status, task and login timeouts before continuing
    clearTimeoutLogin();
    // FIXME How to clear status and task timeouts here ?

    fetch("api/reboot.php").then((response) => {
        if (response.ok) { setTimeout(waitreboot, 1000); }
        return Promise.reject(new Error(response.statusText));
    }).catch((error) => {
        modalReboot.removeAttribute("disable");
        modalReboot.hide();
        if (!fail_loggedin(error)) { modal_message(_("Error during reboot")); }
    });
}
window.dsas_reboot = dsas_reboot;

function dsas_shutdown() {
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
    clearTimeoutLogin();
    // FIXME How to clear status and task timeouts here ?

    fetch("api/shutdown.php").then((response) => {
        if (response.ok) { return setTimeout(waitshutdown, 1000); }
        return Promise.reject(new Error(response.statusText));
    }).catch((error) => {
        modalShutdown.removeAttribute("disable");
        modalShutdown.hide();
        if (!fail_loggedin(error)) { modal_message(_("Error during shutdown")); }
    });
}
window.dsas_shutdown = dsas_shutdown;

function dsas_logout() {
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
        const disablenav = (this.getAttribute("disablenav") ? this.getAttribute("disablenav") : "");

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
        + "        <a class=\"nav-link btn " + disablenav + " btn-danger\" onclick=\"modal_action('" + _("Are you sure you want to apply ?") + "', 'dsas_apply();')\">" + _("Apply") + "</a>\n"
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

if (customElements.get("dsas-header") === undefined) {
    customElements.define("dsas-header", DSASHeader);
}
