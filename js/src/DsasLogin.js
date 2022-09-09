// The javascript used by the DSAS login.html page
import { dsas_origin } from "./DsasUtil";
import { _ } from "./MultiLang";

function dsas_login() {
    const username = document.getElementById("inp_user").value;
    const password = document.getElementById("inp_pass").value;
    const uri = new URL("api/login.php", dsas_origin());

    // Remove existing errors
    document.getElementById("inp_user").setAttribute("class", "form-control");
    document.getElementById("feed_user").innerHTML = "";
    document.getElementById("inp_pass").setAttribute("class", "form-control");
    document.getElementById("feed_pass").innerHTML = "";

    if (!username) {
        document.getElementById("inp_user").setAttribute("class", "form-control is-invalid");
        document.getElementById("feed_user").innerHTML = _("Enter the username.");
        return;
    }

    if (!password) {
        document.getElementById("inp_pass").setAttribute("class", "form-control is-invalid");
        document.getElementById("feed_pass").innerHTML = _("Enter the password.");
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
        document.getElementById("feed_pass").innerHTML = _("Username or password invalid.");
    });
}

// Ensure dsas_init_logdedin is publically available
export default function dsas_init_loggedin() {
    const uri = new URL("api/login.php", dsas_origin());

    document.getElementById("inp_pass").addEventListener("keyup", (e) => {
        document.getElementById("feed_pass").innerHTML = (
            e.getModifierState("CapsLock") ? _("Caps Lock is on") : "");
        document.getElementById("inp_pass").setAttribute(
            "class", (
                e.getModifierState("CapsLock") ? "form-control is-invalid" : "form-control"),
        );
        document.getElementById("inp_user").setAttribute("class", "form-control");
    });

    document.getElementById("login").addEventListener("click", () => { dsas_login(); return false; });
    document.getElementById("inp_pass").addEventListener("keypress", (evt) => {
        if (evt.key === "Enter") { dsas_login(); }
        return false;
    });

    uri.search = new URLSearchParams({ admin: true });
    fetch(uri).then((response) => {
        if (response.ok) { window.location = "index.html"; }
        uri.search = new URLSearchParams({ admin: false });
        fetch(uri).then((response2) => {
            if (response2.ok) { window.location = "passwd.html"; }
        });
    });
}
