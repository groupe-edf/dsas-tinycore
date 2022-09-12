// The javascript used by the DSAS users.html page
import { _ } from "./MultiLang";
import { modal_message, modal_action, modal_errors } from "./DsasModal";
import { fail_loggedin, print_obj } from "./DsasUtil";

export function dsas_user_passwd(user) {
    const modalDSAS = document.getElementById("modalDSAS");
    let body = "";
    modal_action(_("Set password for user '{0}'", user), "dsas_real_user_passwd('" + user + "');", true);
    body = "    <div class=\"col-9 d-flex justify-content-center\">\n"
         + "      <label for=\"UserPassword\">" + _("Password :") + "</label>\n"
         + "      <input type=\"password\" id=\"UserPassword\" value=\"\" class=\"form-control\" onkeypress=\"if (event.key === 'Enter'){ modalDSAS.hide(); dsas_real_user_passwd('" + user + "');}\">\n"
         + "    </div>";
    modalDSAS.setAttribute("body", body);
}
window.dsas_user_passwd = dsas_user_passwd;

export function dsas_real_user_passwd(user) {
    const passwd = document.getElementById("UserPassword").value;
    const formData = new FormData();
    formData.append("op", "passwd");
    formData.append("data", JSON.stringify({ username: user, passwd }));
    fetch("api/dsas-users.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modal_errors(errors);
        } catch (e) {
        // Its text => here always just "Ok". Do nothing
        }
    }).catch((error) => {
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error during password change : {0}", (error.statusText ? error.statusText : error))); }
    });
}
window.dsas_real_user_passwd = dsas_real_user_passwd;

function dsas_real_user_delete(user) {
    const formData = new FormData();
    formData.append("op", "delete");
    formData.append("data", JSON.stringify({ username: user }));
    fetch("api/dsas-users.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modal_errors(errors);
        } catch (e) {
        // Its text => here always just "Ok".
            window.location.reload();
        }
    }).catch((error) => {
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error during user deletion : {0}", (error.statusText ? error.statusText : error))); }
    });
}

export function dsas_user_delete(user) {
    modal_action(_("Delete the user '{0}' ?", user), () => { dsas_real_user_delete(user); }, true);
}
window.dsas_user_delete = dsas_user_delete;

function dsas_user_new() {
    const modalDSAS = document.getElementById("modalDSAS");
    let body = "";
    modal_action(_("New username"), "dsas_real_user_new();", true);
    body = "    <div class=\"col-9 d-flex justify-content-center\">\n"
         + "      <label for=\"NewUser\">" + _("New Username :") + "</label>\n"
         + "      <input type=\"text\" id=\"NewUser\" value=\"\" class=\"form-control\" onkeypress=\"if (event.key === 'Enter'){ modalDSAS.hide(); dsas_real_user_new();}\">\n"
         + "    </div>";
    modalDSAS.setAttribute("body", body);
}

export function dsas_real_user_new() {
    const username = document.getElementById("NewUser").value;
    const formData = new FormData();
    formData.append("op", "add");
    formData.append("data", JSON.stringify({ username }));
    fetch("api/dsas-users.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modal_errors(errors);
        } catch (e) {
        // Its text => here always just "Ok".
            window.location.reload();
        }
    }).catch((error) => {
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error during user creation : {0}", (error.statusText ? error.statusText : error))); }
    });
}
window.dsas_real_user_new = dsas_real_user_new;

function dsas_change_users() {
    fetch("api/dsas-users.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((obj) => {
        const users = obj.user;
        const data = [];
        let type;
        (users.constructor === Object ? [users] : users).forEach((user) => {
            const { username } = user;
            const description = document.getElementById("description_" + username).value;
            [...document.getElementsByTagName("option")].forEach((opt) => {
                if (opt.id === ("admin_" + username) && opt.selected) { type = "admin"; }
                if (opt.id === ("bas_" + username) && opt.selected) { type = "bas"; }
                if (opt.id === ("haut_" + username) && opt.selected) { type = "haut"; }
            });
            const active = (document.getElementById("active_" + username).checked ? "true" : "false");
            data.push({
                username, description, type, active,
            });
        });

        const formData = new FormData();
        formData.append("op", "modify");
        formData.append("data", JSON.stringify(data));
        fetch("api/dsas-users.php", { method: "POST", body: formData }).then((response) => {
            if (response.ok) { return response.text(); }
            return Promise.reject(new Error(response.statusText));
        }).then((text) => {
            try {
                const errors = JSON.parse(text);
                modal_errors(errors);
            } catch (e) {
            // Its text => here always just "Ok".
                modal_message(_("Changes successfully saved"));
            }
        }).catch((error) => {
            if (!fail_loggedin(error.statusText)) { modal_message(_("Error during user creation : {0}", (error.statusText ? error.statusText : error))); }
        });
    }).catch((error) => {
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error ({0}) during the download of users : {1}", error.status, error.statusText)); }
    });
}

export default function dsas_display_users() {
    fetch("api/dsas-users.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((obj) => {
        const users = obj.user;
        let body = "";
        (users.constructor === Object ? [users] : users).forEach((user) => {
            const is_tc = user.username === "tc";
            body += "<tr><th scope=\"row\" id=\"username_" + user.username + "\">" + user.username + "</th>";
            body += "<td><input type=\"text\" id=\"description_" + user.username + "\" value=\"" + print_obj(user.description) + "\" class=\"form-control\"" + (is_tc ? " disabled readonly" : "") + "></td>";
            body += "<td><select class=\"form-select\" name=\"UserType_" + user.username + "\" id=\"UserType_" + user.username + "\"" + (is_tc ? " disabled" : "") + ">"
                + "<option id=\"admin_" + user.username + "\" value=\"admin\"" + (user.type === "admin" ? " selected" : "") + ">" + _("administrator") + "</option>"
                + "<option id=\"bas_" + user.username + "\" value=\"bas\"" + (user.type === "bas" ? " selected" : "") + ">" + _("lower") + "</option>"
                + "<option id=\"haut_" + user.username + "\" value=\"haut\"" + (user.type === "haut" ? " selected" : "") + ">" + _("upper") + "</option>"
                + "</select></td>";
            body += "<td style=\"text-align:center\"><input type=\"checkbox\" id=\"active_" + user.username + "\" class=\"form-check-input\"" + (user.active === "true" ? " checked" : "") + "></td>";
            body += "<td><a data-toggle=\"tooltip\" title=\"" + _("Change Password") + "\" onclick=\"dsas_user_passwd('"
                + user.username + "');\"><img src=\"lock.svg\"></a>";
            if (!is_tc) {
                body += "&nbsp;<a data-toggle=\"tooltip\" title=\"" + _("Delete") + "\" onclick=\"dsas_user_delete('"
                    + user.username + "');\"><img src=\"x-lg.svg\"></a>";
            }
            body += "</td>";
        });
        document.getElementById("Users").innerHTML = body;
        document.getElementById("AddUser").addEventListener("click", () => { dsas_user_new(); });
        document.getElementById("ChangeUsers").addEventListener("click", () => {
            dsas_change_users();
            return false;
        });
    }).catch((error) => {
        if (!fail_loggedin(error.statusText)) {
            if (error.statusText) {
                modal_message(_("Error ({0}) during the download of users : {1}", error.status, error.statusText));
            } else {
                modal_message(_("Error ({0}) during the download of users : {1}", 0, error));
            }
        }
    });
}
