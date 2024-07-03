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

// The javascript used by the DSAS passwd.html page
import { _ } from "./MultiLang";
import { modalMessage, modalErrors } from "./DsasModal";
import { failLoggedin, clearFeedback } from "./DsasUtil";

function dsasChangePasswd() {
    const user = document.getElementById("User").textContent;
    const passwd = document.getElementById("inp_pass").value;
    const formData = new FormData();
    formData.append("data", JSON.stringify({ username: user, passwd }));
    fetch("api/v2/passwd", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((json) => {
        if (Object.prototype.hasOwnProperty.call(json, "retval")) {
            clearFeedback();
            modalMessage(_("Password successfully changed"));
        } else {
            modalErrors(json);
        }
    }).catch((error) => {
        if (!failLoggedin(error)) { modalMessage(_("Error during password change : {0}", (error.message ? error.message : error))); }
    });
}

function dsasLogout() {
    // No error checking because, only possible error is that already logged out
    fetch("api/v2/logout").then(() => {
        window.location.href = "login.html";
    }).catch(() => { window.location.href = "login.html"; });
}

export default function dsasDisplayPasswd() {
    fetch("api/v2/passwd").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((obj) => {
        document.getElementById("User").textContent = obj.username;
        document.getElementById("Type").textContent = obj.type;
    }).catch((error) => {
        if (!failLoggedin(error)) {
            modalMessage(_("Error during password change : {0}", (error.message ? error.message : error)));
        }
    });
    document.getElementById("inp_pass").addEventListener("keypress", (event) => { if (event.key === "Enter") dsasChangePasswd(); });
    document.getElementById("update").addEventListener("click", () => { dsasChangePasswd(); return false; });
    document.getElementById("logout").addEventListener("click", () => { dsasLogout(); return false; });
}
