// DSAS utility functions used almost everywhere
import { ml, _ } from "./MultiLang";
import { modal_message } from "./DsasModal";

// Timeout variable
let timeoutLogin = 0;
export function clearTimeoutLogin() {
    if (timeoutLogin !== 0) { clearTimeout(timeoutLogin); }
}

// Many following functions are used elsewhere just not here. Shut eslint up
// eslint-disable-next-line no-unused-vars
export function cert_name(cert) {
    if (cert.subject.CN) { return cert.subject.CN; }
    if (cert.subject.OU) { return cert.subject.OU; }
    if (cert.subject.O) { return cert.subject.O; }
    if (cert.extensions.subjectKeyIdentifier) { return cert.extensions.subjectKeyIdentifier; }
    return "name";
}
window.cert_name = cert_name;

export function empty_obj(obj) {
    if (!obj || Object.keys(obj).length === 0 || obj === "undefined") { return true; }
    return false;
}
window.empty_obj = empty_obj;

// eslint-disable-next-line no-unused-vars
export function print_obj(obj) {
    return (empty_obj(obj) ? "" : _(obj));
}
window.print_obj = print_obj;

// eslint-disable-next-line no-unused-vars
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
window.date_to_locale = date_to_locale;

// eslint-disable-next-line no-unused-vars
export function clear_feedback() {
    // eslint-disable-next-line no-param-reassign
    document.getElementsByClassName("invalid-feedback").forEach((feed) => { feed.innerHTML = ""; });
    document.getElementsByClassName("form-control").forEach((feed) => { feed.setAttribute("class", "form-control"); });
}
window.clear_feedback = clear_feedback;

export function dsas_origin() {
    // Can't just use window.location.origin as we might be wrapped in a WebSSL portal
    const s = String(window.location);
    return s.substring(0, s.lastIndexOf("/") + 1);
}
window.dsas_origin = dsas_origin;

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

export function fail_loggedin(status) {
    if (status === "Forbidden") {
        modal_message(
            _("You are not connected. Click 'Ok' to reconnect."),
            "window.location='login.html'",
        );
        return true;
    } return false;
}
window.fail_loggedin = fail_loggedin;

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

export function cert_is_ca(cert) {
    if (!cert.extensions.authorityKeyIdentifier
            || cert.extensions.authorityKeyIdentifier
                .indexOf(cert.extensions.subjectKeyIdentifier) >= 0) { return true; }
    return false;
}
window.cert_is_ca = cert_is_ca;
