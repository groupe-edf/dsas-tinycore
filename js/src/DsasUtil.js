// DSAS utility functions used almost everywhere
import { ml, _ } from "./MultiLang";
import { modal_message } from "./DsasModal";

// Store the references to the timeouts so that they can be cleared
let timeouts = [];

export function dsasSetTimeout(ref, func, delay, ...args) {
    const newtimeouts = [];
    timeouts.forEach((timeout) => {
        if (timeout[0] === ref) {
            clearTimeout(timeout[1]);
        } else {
            newtimeouts.push(timeout);
        }
    });
    timeouts = newtimeouts;
    const timer = setTimeout(func, delay, ...args);
    timeouts.push([ref, timer]);
}

export function dsasClearTimeout(ref) {
    const newtimeouts = [];
    timeouts.forEach((timeout) => {
        if (timeout[0] === ref) {
            clearTimeout(timeout[1]);
        } else {
            newtimeouts.push(timeout);
        }
    });
    timeouts = newtimeouts;
}

export function dsasClearAllTimeouts() {
    timeouts.forEach((timeout) => {
        clearTimeout(timeout[1]);
    });
    timeouts = [];
}

export function cert_name(cert) {
    if (cert.subject.CN) { return cert.subject.CN; }
    if (cert.subject.OU) { return cert.subject.OU; }
    if (cert.subject.O) { return cert.subject.O; }
    if (cert.extensions.subjectKeyIdentifier) { return cert.extensions.subjectKeyIdentifier; }
    return "name";
}

export function empty_obj(obj) {
    if (!obj || Object.keys(obj).length === 0 || obj === "undefined") { return true; }
    return false;
}

export function print_obj(obj) {
    return (empty_obj(obj) ? "" : _(obj));
}

export function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function date_to_locale(d) {
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
        if (d.length < 14) {
            return c.format(new Date("20" + d.substr(0, 2) + "-" + d.substr(2, 2) + "-" + d.substr(4, 2) + "T"
               + d.substr(6, 2) + ":" + d.substr(8, 2) + ":" + d.substr(10, 2) + "Z"));
        }
        return c.format(new Date(d.substr(0, 4) + "-" + d.substr(4, 2) + "-" + d.substr(6, 2) + "T"
           + d.substr(8, 2) + ":" + d.substr(10, 2) + ":" + d.substr(12, 2) + "Z"));
    }
    const ret = [];
    d.forEach((d2) => {
        if (d2.length < 14) {
            ret.push(c.format(new Date("20" + d2.substr(0, 2) + "-" + d2.substr(2, 2) + "-" + d2.substr(4, 2) + "T"
               + d2.substr(6, 2) + ":" + d2.substr(8, 2) + ":" + d2.substr(10, 2) + "Z")));
        } else {
            ret.push(c.format(new Date(d2.substr(0, 4) + "-" + d2.substr(4, 2) + "-" + d2.substr(6, 2) + "T"
               + d2.substr(8, 2) + ":" + d2.substr(10, 2) + ":" + d2.substr(12, 2) + "Z")));
        }
    });
    return ret;
}

export function clear_feedback() {
    // eslint-disable-next-line no-param-reassign
    [...document.getElementsByClassName("invalid-feedback")].forEach((feed) => { feed.textContent = ""; });
    [...document.getElementsByClassName("form-control")].forEach((feed) => { feed.setAttribute("class", "form-control"); });
}

export function dsas_origin() {
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
        dsasClearTimeout("login");
        dsasSetTimeout("login", dsas_loggedin, 15000, false, is_admin);
        return response.text();
    }).catch(() => {
        modal_message(
            _("You are not connected. Click 'Ok' to reconnect."),
            () => { window.location = "login.html"; },
        );
    });
}

export function fail_loggedin(status) {
    if (status && String(status).includes("Forbidden")) {
        dsasClearTimeout("login");
        modal_message(
            _("You are not connected. Click 'Ok' to reconnect."),
            () => { window.location = "login.html"; },
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
        fail_loggedin(error);
    });

    fetch("api/dsas-get-warning.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((obj) => {
        if (obj !== null) {
            let error = false;
            const body = document.createDocumentFragment();
            obj.forEach((line) => {
                if (line.type === "warn") {
                    const el = body.append(document.createElement("p"));
                    el.textContent = _(line.msg);
                    el.className = "text-warning";
                } else {
                    const el = body.append(document.createElement("p"));
                    el.textContent = _(line.msg);
                    el.className = "text-danger";
                    error = true;
                }
            });
            if (error && disablenav) {
                document.getElementsByTagName("dsas-header")[0].setAttribute("disablenav", "disabled");
            }
            if (body.firstChild) {
                modal_message(_("Error :"));
                document.getElementById("modalDSAS").setBody(body);
            }
        }
    }).catch((error) => {
        fail_loggedin(error);
    });
}

export function cert_is_ca(cert) {
    if (!cert.extensions.authorityKeyIdentifier
            || cert.extensions.authorityKeyIdentifier
                .indexOf(cert.extensions.subjectKeyIdentifier) >= 0) { return true; }
    return false;
}
