// The javascript used by the DSAS passwd.html page

// These functions are in another file
/* globals _ modal_message modal_errors clear_feedback fail_loggedin */

export function dsas_display_passwd() {
    fetch("api/dsas-passwd.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((obj) => {
        document.getElementById("User").innerHTML = obj.username;
        document.getElementById("Type").innerHTML = obj.type;
    }).catch((error) => {
        if (!fail_loggedin(error.statusText)) {
            if (error.status) { modal_message(_("Error ({0}) during the machine detection : {1}", error.status, error.statusText)); } else { modal_message(_("Error : {0}", error)); }
        }
    });
}

export function dsas_change_passwd() {
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
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error during password change : {0}", error.statusText)); }
    });
}
