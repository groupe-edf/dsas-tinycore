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

// The javascript used by the DSAS login.html page
import { dsasOrigin } from "./DsasUtil";
import { _ } from "./MultiLang";

function dsasLogin() {
    const username = document.getElementById("inp_user").value;
    const password = document.getElementById("inp_pass").value;
    const uri = new URL("api/login.php", dsasOrigin());

    // Remove existing errors
    document.getElementById("inp_user").setAttribute("class", "form-control");
    document.getElementById("feed_user").textContent = "";
    document.getElementById("inp_pass").setAttribute("class", "form-control");
    document.getElementById("feed_pass").textContent = "";

    if (!username) {
        document.getElementById("inp_user").setAttribute("class", "form-control is-invalid");
        document.getElementById("feed_user").textContent = _("Enter the username.");
        return;
    }

    if (!password) {
        document.getElementById("inp_pass").setAttribute("class", "form-control is-invalid");
        document.getElementById("feed_pass").textContent = _("Enter the password.");
        return;
    }

    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    fetch("api/login.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) {
            uri.search = new URLSearchParams({ admin: true });
            fetch(uri).then((response2) => {
                if (response2.ok) {
                    window.location = "index.html";
                } else {
                    uri.search = new URLSearchParams({ admin: false });
                    fetch(uri).then((response3) => {
                        if (response3.ok) { window.location = "passwd.html"; }
                    });
                }
            });
            return true;
        }
        return Promise.reject(new Error(response.statusText));
    }).catch(() => {
        document.getElementById("inp_user").setAttribute("class", "form-control is-invalid");
        document.getElementById("inp_pass").setAttribute("class", "form-control is-invalid");
        document.getElementById("feed_pass").textContent = _("Username or password invalid.");
    });
}

// Ensure dsas_init_logdedin is publically available
export default function dsasInitLoggedin() {
    const uri = new URL("api/login.php", dsasOrigin());

    document.getElementById("inp_pass").addEventListener("keyup", (e) => {
        document.getElementById("feed_pass").textContent = (
            e.getModifierState("CapsLock") ? _("Caps Lock is on") : "");
        document.getElementById("inp_pass").setAttribute(
            "class", (
                e.getModifierState("CapsLock") ? "form-control is-invalid" : "form-control"),
        );
        document.getElementById("inp_user").setAttribute("class", "form-control");
    });

    document.getElementById("login").addEventListener("click", () => { dsasLogin(); return false; });
    document.getElementById("inp_pass").addEventListener("keypress", (evt) => {
        if (evt.key === "Enter") { dsasLogin(); }
        return false;
    });

    uri.search = new URLSearchParams({ admin: true });
    fetch(uri).then((response) => {
        if (response.ok) {
            window.location = "index.html";
        } else {
            uri.search = new URLSearchParams({ admin: false });
            fetch(uri).then((response2) => {
                if (response2.ok) { window.location = "passwd.html"; }
            });
        }
    });
}
