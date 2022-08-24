// The javascript used by the DSAS login.html page

// These functions are in another file
/* globals _ dsas_origin */

export function dsas_init_loggedin() {
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

    uri.search = new URLSearchParams({ admin: true });
    fetch(uri).then((response) => {
        if (response.ok) { window.location = "index.html"; }
        uri.search = new URLSearchParams({ admin: false });
        fetch(uri).then((response2) => {
            if (response2.ok) { window.location = "passwd.html"; }
        });
    });
}
window.dsas_init_loggedin = dsas_init_loggedin;

export function dsas_login() {
    const username = document.getElementById("inp_user").value;
    const password = document.getElementById("inp_pass").value;

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
        if (response.ok) { dsas_init_loggedin(); return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).catch(() => {
        document.getElementById("inp_user").setAttribute("class", "form-control is-invalid");
        document.getElementById("inp_pass").setAttribute("class", "form-control is-invalid");
        document.getElementById("feed_pass").innerHTML = _("Username or password invalid.");
    });
}
window.dsas_login = dsas_login;
