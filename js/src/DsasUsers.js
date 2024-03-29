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

// The javascript used by the DSAS users.html page
import { ml, _ } from "./MultiLang";
import { modalMessage, modalAction, modalErrors } from "./DsasModal";
import { failLoggedin, printObj } from "./DsasUtil";

// Positions for dragged items
let dragfrom = NaN;
let dragto = NaN;

function dsasRealUserPasswd(user) {
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
            modalErrors(errors);
        } catch (e) {
        // Its text => here always just "Ok". Do nothing
        }
    }).catch((error) => {
        if (!failLoggedin(error)) { modalMessage(_("Error during password change : {0}", (error.message ? error.message : error))); }
    });
}

function dsasUserPasswd(user) {
    const modalDSAS = document.getElementById("modalDSAS");
    modalAction(_("Set password for user '{0}'", user), () => { dsasRealUserPasswd(user); }, true);
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
            dsasRealUserPasswd(user);
        }
    });
    modalDSAS.setBody(body);
}

function dsasRealUserDelete(user) {
    const formData = new FormData();
    formData.append("op", "delete");
    formData.append("data", JSON.stringify({ username: user }));
    fetch("api/dsas-users.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modalErrors(errors);
        } catch (e) {
        // Its text => here always just "Ok".
            window.location.reload();
        }
    }).catch((error) => {
        if (!failLoggedin(error)) { modalMessage(_("Error during user deletion : {0}", (error.message ? error.message : error))); }
    });
}

function dsasUserDelete(user) {
    modalAction(_("Delete the user '{0}' ?", user), () => { dsasRealUserDelete(user); }, true);
}

function dsasRealUserNew() {
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
            modalErrors(errors);
        } catch (e) {
        // Its text => here always just "Ok".
            window.location.reload();
        }
    }).catch((error) => {
        if (!failLoggedin(error)) { modalMessage(_("Error during user creation : {0}", (error.message ? error.message : error))); }
    });
}

function dsasUserNew() {
    const modalDSAS = document.getElementById("modalDSAS");
    modalAction(_("New username"), dsasRealUserNew, true);
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
            dsasRealUserNew();
        }
    });
    modalDSAS.setBody(body);
}

function dsasChangeUsers() {
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
                modalErrors(errors);
            } catch (e) {
            // Its text => here always just "Ok".
                modalMessage(_("Changes successfully saved"));
            }
        }).catch((error) => {
            if (!failLoggedin(error)) { modalMessage(_("Error during user creation : {0}", (error.message ? error.message : error))); }
        });
    }).catch((error) => {
        if (!failLoggedin(error)) { modalMessage(_("Error ({0}) during the download of users : {1}", 0, (error.message ? error.message : error))); }
    });
}

function dsasUserDrop(from, to) {
    if (from !== to && from !== to + 1) {
        const formData = new FormData();
        formData.append("op", "drag");
        formData.append("data", JSON.stringify({ from, to }));
        fetch("api/dsas-users.php", { method: "POST", body: formData }).then((response) => {
            if (response.ok) { return response.text(); }
            return Promise.reject(new Error(response.statusText));
        }).then((text) => {
            try {
                const errors = JSON.parse(text);
                modalErrors(errors);
            } catch (e) {
                // Disable ESLINT here as circular refering behind the functions
                /* eslint-disable-next-line no-use-before-define */
                dsasDisplayUsers();
            }
        }).catch((error) => {
            if (!failLoggedin(error)) {
                modalMessage(_("Error : {0}", (error.message ? error.message : error)));
            }
        });
    }
}

export default function dsasDisplayUsers() {
    fetch("api/dsas-users.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((obj) => {
        const temp = document.getElementById("usertemplate");
        const users = obj.user;
        let i = 0;
        document.getElementById("Users").textContent = ""; // Clear old content
        (users.constructor === Object ? [users] : users).forEach((user) => {
            const isTc = user.username === "tc";
            const line = temp.content.cloneNode(true);
            ml.translateHTML(line);
            line.querySelector("th").id = "username_" + user.username;
            line.querySelector("th").textContent = user.username;
            const draguser = line.querySelector("tr");
            const inp = line.querySelectorAll("input");
            inp[0].id = "description_" + user.username;
            inp[0].value = printObj(user.description);
            if (isTc) {
                inp[0].setAttribute("disabled", "");
                inp[0].setAttribute("readonly", "");
                draguser.setAttribute("draggable", "false"); // User tc should always be first
            } else {
                inp[0].removeAttribute("disabled");
                inp[0].removeAttribute("readonly");
            }
            line.querySelector("select").name = "UserType_" + user.username;
            line.querySelector("select").id = "UserType_" + user.username;
            if (isTc) {
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
            line.querySelectorAll("a")[0].addEventListener("click", () => { dsasUserPasswd(user.username); });
            if (isTc) {
                line.querySelectorAll("a")[1].setAttribute("hidden", "");
                line.querySelectorAll("a")[1].setAttribute("disabled", "");
            } else {
                line.querySelectorAll("a")[1].removeAttribute("hidden");
                line.querySelectorAll("a")[1].removeAttribute("disabled");
                line.querySelectorAll("a")[1].addEventListener("click", () => { dsasUserDelete(user.username); });
            }

            draguser.id = "drag" + i;
            if (!isTc) draguser.addEventListener("drag", ((d) => (() => { dragfrom = d; }))(i));
            draguser.addEventListener("dragover", (e) => {
                // equivalent to "let target = e.target;" but keeps eslint happy
                let { target } = e;
                e.preventDefault();
                while (target.className !== "body") {
                    if (target.id.substring(0, 4) === "drag"
                        && target.getAttribute("draggable")) break;
                    target = target.parentElement;
                }
                dragto = parseInt(target.id.substring(4), 10);
            });
            draguser.addEventListener("drop", () => { dsasUserDrop(dragfrom, dragto); });

            i += 1;
            document.getElementById("Users").appendChild(line);
        });
        document.getElementById("AddUser").addEventListener("click", dsasUserNew);
        document.getElementById("ChangeUsers").addEventListener("click", () => {
            dsasChangeUsers();
            return false;
        });
    }).catch((error) => {
        if (!failLoggedin(error)) {
            modalMessage(_("Error ({0}) during the download of users : {1}", 0, (error.message ? error.message : error)));
        }
    });
}
