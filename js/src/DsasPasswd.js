// The javascript used by the DSAS passwd.html page
import { _ } from "./MultiLang";
import { modal_message, modal_errors } from "./DsasModal";
import { fail_loggedin, clear_feedback } from "./DsasUtil";

function dsas_change_passwd() {
    const user = document.getElementById("User").innerHTML;
    const passwd = document.getElementById("inp_pass").value;
    const formData = new FormData();
    formData.append("data", JSON.stringify({ username: user, passwd }));
    fetch("api/dsas-passwd.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modal_errors(errors);
        } catch (e) {
        // Its text => here always just "Ok".
            clear_feedback();
            modal_message(_("Password successfully changed"));
        }
    }).catch((error) => {
        if (!fail_loggedin(error)) { modal_message(_("Error during password change : {0}", (error.message ? error.message : error))); }
    });
}

function dsas_logout() {
    // No error checking because, only possible error is that already logged out
    fetch("api/logout.php").then(() => {
        window.location.href = "login.html";
    }).catch(() => { window.location.href = "login.html"; });
}

export default function dsas_display_passwd() {
    fetch("api/dsas-passwd.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((obj) => {
        document.getElementById("User").innerHTML = obj.username;
        document.getElementById("Type").innerHTML = obj.type;
    }).catch((error) => {
        if (!fail_loggedin(error)) {
            modal_message(_("Error during password change : {0}", (error.message ? error.message : error)));
        }
    });
    document.getElementById("update").addEventListener("click", () => { dsas_change_passwd(); return false; });
    document.getElementById("logout").addEventListener("click", () => { dsas_logout(); return false; });
}
