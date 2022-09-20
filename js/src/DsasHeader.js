// DSAS functions used in the page header
import { ml, _ } from "./MultiLang";
import { modal_message, modal_action, modal_errors } from "./DsasModal";
import { fail_loggedin, dsas_origin, dsasClearAllTimeouts } from "./DsasUtil";

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
    const spinner = document.createDocumentFragment();
    let el = spinner.appendChild(document.createElement("span"));
    el.className = "spinner-border spinner-border-sm";
    el = spinner.appendChild(document.createElement("span"));
    el.textContent = _(" Backup of the configuration in progress");
    modalApply.removeAttribute("title");
    modalApply.setAttribute("disable", true);
    modalApply.setBody(spinner);
    modalApply.show();

    fetch("api/save.php").then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then(() => {
        const spinner2 = document.createDocumentFragment();
        let el2 = spinner2.appendChild(document.createElement("span"));
        el2.className = "spinner-border spinner-border-sm";
        el2 = spinner2.appendChild(document.createElement("span"));
        el2.textContent = _(" Application of the configuration in progress");
        modalApply.setBody(spinner2);
        fetch("api/apply.php").then((response) => {
            if (response.ok) { return response.text(); }
            return Promise.reject(new Error(response.statusText));
        }).then(() => {
            modalApply.removeAttribute("disable");
            modalApply.setBody("");
            modalApply.hide();
            modal_message(_("Configuration applied"));
        }).catch(() => {
            modalApply.removeAttribute("disable");
            modalApply.setBody("");
            modalApply.hide();
            modal_message(_("Error during application of the configuration"));
        });
    }).catch((error) => {
        modalApply.removeAttribute("disable");
        modalApply.setBody("");
        modalApply.hide();
        if (!fail_loggedin(error)) { modal_message(_("Error during save of the configuration")); }
    });
}

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

function dsas_backup() {
    const modalDSAS = document.getElementById("modalDSAS");
    const body = document.createDocumentFragment();
    modal_action(_("Backup the DSAS configuration"), () => { dsas_real_backup(); }, true);
    const el = body.appendChild(document.createElement("div"));
    el.className = "col-9 d-flex justify-content-center";
    let el2 = el.appendChild(document.createElement("label"));
    el2.setAttribute("for", "BackupPassword");
    el2.textContent = _("Backup password :");
    el2 = el.appendChild(document.createElement("input"));
    el2.className = "form-control";
    el2.id = "BackupPassword";
    el2.addEventListener("keypress", (e) => { if (e.key === "Enter") { modalDSAS.hide(); dsas_real_backup(); } });
    modalDSAS.setBody(body);
}

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
            modalDSAS.setBody("");
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
// This needs to be exposed so test code can use it
window.dsas_restore_core = dsas_restore_core;

function dsas_real_restore() {
    const passwd = document.getElementById("RestorePassword").value;
    const file = document.getElementById("RestoreSelectFile").files[0];
    dsas_restore_core(file, passwd);
}

function dsas_passwd_restore() {
    const modalDSAS = document.getElementById("modalDSAS");
    const body = document.createDocumentFragment();
    modal_action(_("Restoration of the DSAS configuration"), dsas_real_restore, true);

    const el = body.appendChild(document.createElement("div"));
    el.className = "col-9 d-flex justify-content-center";
    let el2 = el.appendChild(document.createElement("label"));
    el2.setAttribute("for", "RetorePassword");
    el2.textContent = _("Restoration password :");
    el2 = el.appendChild(document.createElement("input"));
    el2.className = "form-control";
    el2.id = "RestorePassword";
    el2.addEventListener("keypress", (e) => { if (e.key === "Enter") { modalDSAS.hide(); dsas_real_restore(); } });
    modalDSAS.setBody(body);
}

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

function chkdown(site) {
    const times = 5;
    const progress = document.getElementById("progressShutdown");

    return new Promise((response, reject) => {
        (function recurse(s, i) {
            let c = i;
            // Use a controller to abort fetch every second
            const controller = new AbortController();
            const id = setTimeout(() ==> controller.abort(), 1000);
            // favicon because its small and Math.random to avoid the cache
            fetch(s + "/favicon.ico?rand=" + Math.random(), {signal: controller.signal}).then((r) => {
                clearTimeout(id);
                if (c === 30) { return reject(r); }
                c += 1;
                const prog = ((c + 5) * 100) / 30;
                progress.setAttribute("style", "width: " + prog + "%");
                progress.setAttribute("aria-valuenow", prog);
                return setTimeout(recurse, 1000, s, c);
            }).catch((err) => {
                // Machine is down return success
                clearTimeout(id);
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
            const controller = new AbortController();
            const id = setTimeout(() ==> controller.abort(), 1000);
            // favicon because its small and Math.random to avoid the cache
            fetch(s + "/favicon.ico?rand=" + Math.random(), {signal: controller.signal}).then((r) => {
                // Machine is up. Return success
                clearTimeout(id);
                response(r);
            }).catch((err) => {
                clearTimeout(id);
                if (c === 30) { return reject(err); }
                c += 1;
                const prog = ((i + 5) * 100) / 30;
                progress.setAttribute("style", "width: " + prog + "%");
                progress.setAttribute("aria-valuenow", prog);
                return setTimeout(recurse, 1000, s, c);
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
    modalReboot.removeAttribute("title");
    const body = document.createElement("div");
    body.className = "row";
    let el = body.appendChild(document.createElement("div"));
    el.className = "col-8";
    let el2 = el.appendChild(document.createElement("span"));
    el2.className = "spinner-border spinner-border-sm";
    el2 = el.appendChild(document.createElement("span"));
    el2.textContent = " " + _("Rebooting the DSAS");
    el = body.appendChild(document.createElement("div"));
    el.className = "col-4 my-auto";
    el2 = el.appendChild(document.createElement("div"));
    el2.className = "progress";
    el2 = el2.appendChild(document.createElement("div"));
    el2.className = "progress-bar";
    el2.id = "progressReboot";
    el2.setAttribute("role", "progressbar");
    el2.setAttribute("aria-valuemin", "0");
    el2.setAttribute("aria-valuemax", "100");
    modalReboot.setBody(body);

    // Clear status, task and login timeouts before continuing
    dsasClearAllTimeouts();

    fetch("api/reboot.php").then((response) => {
        if (response.ok) { return setTimeout(waitreboot, 1000); }
        return Promise.reject(new Error(response.statusText));
    }).catch((error) => {
        modalReboot.removeAttribute("disable");
        modalReboot.hide();
        if (!fail_loggedin(error)) { modal_message(_("Error during reboot")); }
    });
}

function dsas_shutdown() {
    const modalShutdown = document.getElementById("modalDSAS");
    modalShutdown.setAttribute("disable", true);
    const body = document.createElement("div");
    body.className = "row";
    let el = body.appendChild(document.createElement("div"));
    el.className = "col-8";
    let el2 = el.appendChild(document.createElement("span"));
    el2.className = "spinner-border spinner-border-sm";
    el2 = el.appendChild(document.createElement("span"));
    el2.textContent = " " + _("Shutting down the DSAS");
    el = body.appendChild(document.createElement("div"));
    el.className = "col-4 my-auto";
    el2 = el.appendChild(document.createElement("div"));
    el2.className = "progress";
    el2 = el2.appendChild(document.createElement("div"));
    el2.className = "progress-bar";
    el2.id = "progressShutdown";
    el2.setAttribute("role", "progressbar");
    el2.setAttribute("aria-valuemin", "0");
    el2.setAttribute("aria-valuemax", "100");
    modalShutdown.setBody(body);

    // Clear status and login timeouts before continuing
    dsasClearAllTimeouts();

    fetch("api/shutdown.php").then((response) => {
        if (response.ok) { return setTimeout(waitshutdown, 1000); }
        return Promise.reject(new Error(response.statusText));
    }).catch((error) => {
        modalShutdown.removeAttribute("disable");
        modalShutdown.hide();
        if (!fail_loggedin(error)) { modal_message(_("Error during shutdown")); }
    });
}

function dsas_logout() {
    // No error checking because, only possible error is that already logged out
    fetch("api/logout.php").then(() => {
        window.location.href = "login.html";
    }).catch(() => { window.location.href = "login.html"; });
}

class DSASHeader extends HTMLElement {
    connectedCallback() {
        if (!this.rendered) {
            this.render();
            this.rendered = true;
        }
    }

    render() {
        const disablenav = (this.getAttribute("disablenav") ? this.getAttribute("disablenav") : "");

        // FIXME Remove innerHTML ?
        // This isn't a security risk as there are no user defined fields in the html below
        // Maybe at least remove disablenav and treat seperately in JS ?
        this.innerHTML = `    <div class="row g-0 sticky-top"><div class="col-8"><nav class="navbar navbar-expand-sm bg-dark navbar-dark">
      <a class="navbar-brand px-2"` + ((disablenav !== "disabled") ? " href=\"/\"" : "") + `>DSAS</a>
      <ul class="navbar-nav">
      <li class="nav-item dropdown">
        <a class="nav-link ` + disablenav + ` dropdown-toggle" data-bs-toggle="dropdown" data-i18n>Configuration</a>
        <div class="dropdown-menu">
          <a class="dropdown-item" href="tasks.html" data-i18n>Tasks</a>
          <a class="dropdown-item" href="cert.html" data-i18n>Certificates</a>
          <a class="dropdown-item" href="service.html" data-i18n>Services</a>
          <a class="dropdown-item" href="net.html" data-i18n>Network</a>
          <a class="dropdown-item" href="web.html" data-i18n>Web</a>
        </div>
      </li> 
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" data-bs-toggle="dropdown" data-i18n>System</a>
        <div class="dropdown-menu">
          <a class="dropdown-item" href="users.html" data-i18n>Users</a>
          <a class="dropdown-item ` + disablenav + `" id="headbackup" data-i18n>Backup</a>
          <a class="dropdown-item" id="headrestore" data-i18n>Restore</a>
          <a class="dropdown-item ` + disablenav + `" id="headreboot" data-i18n>Restart</a>
          <a class="dropdown-item ` + disablenav + `" id="headshutdown" data-i18n>Shutdown</a>
          <a class="dropdown-item ` + disablenav + `" id="headlogout" data-i18n>Logout</a>
        </div>
      </li>
      <li class="nav-item">
        <a class="nav-link ` + disablenav + `" id="headhelp" href="help.html" data-i18n>Documentation</a>
      </li>
      </ul>
    </nav></div>
    <div class="col-4"><nav class="navbar navbar-expand-sm bg-dark navbar-dark">
      <ul class="navbar-nav ms-auto">
      <span data-i18n-navbar-lang></span>
      <li class="nav-item px-2">
        <a class="btn ` + disablenav + ` btn-danger" id="applyDSAS" data-i18n>Apply</a>
      </li>
      </ul>
    </nav></div></div>
    <dsas-modal id="modalDSAS" tag="DSAS"  type="Ok"></dsas-modal>`;

        document.getElementById("headbackup").addEventListener("click", () => { dsas_backup(); });
        document.getElementById("headrestore").addEventListener("click", () => { dsas_restore(); });
        document.getElementById("headreboot").addEventListener("click", () => { modal_action(_("Are you sure you want to restart ?"), dsas_reboot); });
        document.getElementById("headshutdown").addEventListener("click", () => { modal_action(_("Are you sure you want to shutdown ?"), dsas_shutdown); });
        document.getElementById("headlogout").addEventListener("click", () => { modal_action(_("Are you sure you want to logout ?"), dsas_logout, true); });
        document.getElementById("applyDSAS").addEventListener("click", () => { modal_action(_("Are you sure you want to apply ?"), dsas_apply, true); });
        if (ml.currentLanguage) { document.getElementById("headhelp").href = "help.html?language=" + ml.currentLanguage; }
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
