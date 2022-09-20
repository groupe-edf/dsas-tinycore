// The javascript used by the DSAS users.html page
import { ml, _ } from "./MultiLang";
import { modal_message, modal_action, modal_errors } from "./DsasModal";
import { fail_loggedin, print_obj } from "./DsasUtil";

function dsas_real_user_passwd(user) {
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
        if (!fail_loggedin(error)) { modal_message(_("Error during password change : {0}", (error.message ? error.message : error))); }
    });
}

function dsas_user_passwd(user) {
    const modalDSAS = document.getElementById("modalDSAS");
    modal_action(_("Set password for user '{0}'", user), () => { dsas_real_user_passwd(user); }, true);
    const body = document.createElement("div");
    body.class = "col-9 d-flex justify-content-center";
    const el1 = body.appendChild(document.createElement("label"));
    el1.setAttribute("for", "UserPassword");
    el1.textContent = _("Password :");
    const el2 = body.appendChild(document.createElement("input"));
    el2.type = "password";
    el2.id = "UserPassword";
    el2.className = "form-control";
    el2.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            modalDSAS.hide();
            dsas_real_user_passwd(user);
        }
    });
    modalDSAS.setBody(body);
}

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
        if (!fail_loggedin(error)) { modal_message(_("Error during user deletion : {0}", (error.message ? error.message : error))); }
    });
}

function dsas_user_delete(user) {
    modal_action(_("Delete the user '{0}' ?", user), () => { dsas_real_user_delete(user); }, true);
}

function dsas_real_user_new() {
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
        if (!fail_loggedin(error)) { modal_message(_("Error during user creation : {0}", (error.message ? error.message : error))); }
    });
}

function dsas_user_new() {
    const modalDSAS = document.getElementById("modalDSAS");
    modal_action(_("New username"), () => { dsas_real_user_new(); }, true);
    const body = document.createElement("div");
    body.class = "col-9 d-flex justify-content-center";
    const el1 = body.appendChild(document.createElement("label"));
    el1.setAttribute("for", "NewUser");
    el1.textContent = _("New username :");
    const el2 = body.appendChild(document.createElement("input"));
    el2.type = "text";
    el2.id = "NewUser";
    el2.className = "form-control";
    el2.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            modalDSAS.hide();
            dsas_real_user_new();
        }
    });
    modalDSAS.setBody(body);
}

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
            if (!fail_loggedin(error)) { modal_message(_("Error during user creation : {0}", (error.message ? error.message : error))); }
        });
    }).catch((error) => {
        if (!fail_loggedin(error)) { modal_message(_("Error ({0}) during the download of users : {1}", 0, (error.message ? error.message : error))); }
    });
}

export default function dsas_display_users() {
    fetch("api/dsas-users.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((obj) => {
        const temp = document.getElementById("usertemplate");
        const users = obj.user;
        document.getElementById("Users").textContent = ""; // Clear old content
        (users.constructor === Object ? [users] : users).forEach((user) => {
            const is_tc = user.username === "tc";
            const line = temp.content.cloneNode(true);
            ml.translateHTML(line);
            line.querySelector("th").id = "username_" + user.username;
            line.querySelector("th").textContent = user.username;
            const inp = line.querySelectorAll("input");
            inp[0].id = "description_" + user.username;
            inp[0].value = print_obj(user.description);
            if (is_tc) {
                inp[0].setAttribute("disabled", "");
                inp[0].setAttribute("readonly", "");
            } else {
                inp[0].removeAttribute("disabled");
                inp[0].removeAttribute("readonly");
            }
            line.querySelector("select").name = "UserType_" + user.username;
            line.querySelector("select").id = "UserType_" + user.username;
            if (is_tc) {
                line.querySelector("select").setAttribute("disabled", "");
            } else {
                line.querySelector("select").removeAttribute("disabled");
            }
            const opt = line.querySelectorAll("option");
            opt[0].id = "admin_" + user.username;
            opt[0].name = "admin_" + user.username;
            if (user.type === "admin") {
                opt[0].setAttribute("selected", "");
            } else {
                opt[0].removeAttribute("selected", "");
            }
            opt[1].id = "bas_" + user.username;
            opt[1].name = "bas_" + user.username;
            if (user.type === "bas") {
                opt[1].setAttribute("selected", "");
            } else {
                opt[1].removeAttribute("selected", "");
            }
            opt[2].id = "haut_" + user.username;
            opt[2].name = "haut_" + user.username;
            if (user.type === "haut") {
                opt[2].setAttribute("selected", "");
            } else {
                opt[2].removeAttribute("selected", "");
            }
            inp[1].id = "active_" + user.username;
            if (user.active === "true") {
                inp[1].setAttribute("checked", "");
            } else {
                inp[1].removeAttribute("checked", "");
            }
            line.querySelectorAll("a")[0].addEventListener("click", () => { dsas_user_passwd(user.username); });
            if (is_tc) {
                line.querySelectorAll("a")[1].setAttribute("hidden", "");
                line.querySelectorAll("a")[1].setAttribute("disabled", "");
            } else {
                line.querySelectorAll("a")[1].removeAttribute("hidden");
                line.querySelectorAll("a")[1].removeAttribute("disabled");
                line.querySelectorAll("a")[1].addEventListener("click", () => { dsas_user_delete(user.username); });
            }
            document.getElementById("Users").appendChild(line);
        });
        document.getElementById("AddUser").addEventListener("click", () => { dsas_user_new(); });
        document.getElementById("ChangeUsers").addEventListener("click", () => {
            dsas_change_users();
            return false;
        });
    }).catch((error) => {
        if (!fail_loggedin(error)) {
            modal_message(_("Error ({0}) during the download of users : {1}", 0, (error.message ? error.message : error)));
        }
    });
}
