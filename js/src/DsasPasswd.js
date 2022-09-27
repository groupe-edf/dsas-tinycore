// The javascript used by the DSAS passwd.html page
import { _ } from "./MultiLang";
import { modalMessage, modalErrors } from "./DsasModal";
import { failLoggedin, clearFeedback } from "./DsasUtil";

function dsasChangePasswd() {
    const user = document.getElementById("User").textContent;
    const passwd = document.getElementById("inp_pass").value;
    const formData = new FormData();
    formData.append("data", JSON.stringify({ username: user, passwd }));
    fetch("api/dsas-passwd.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modalErrors(errors);
        } catch (e) {
        // Its text => here always just "Ok".
            clearFeedback();
            modalMessage(_("Password successfully changed"));
        }
    }).catch((error) => {
        if (!failLoggedin(error)) { modalMessage(_("Error during password change : {0}", (error.message ? error.message : error))); }
    });
}

function dsasLogout() {
    // No error checking because, only possible error is that already logged out
    fetch("api/logout.php").then(() => {
        window.location.href = "login.html";
    }).catch(() => { window.location.href = "login.html"; });
}

export default function dsasDisplayPasswd() {
    fetch("api/dsas-passwd.php").then((response) => {
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
    document.getElementById("update").addEventListener("click", () => { dsasChangePasswd(); return false; });
    document.getElementById("logout").addEventListener("click", () => { dsasLogout(); return false; });
}
