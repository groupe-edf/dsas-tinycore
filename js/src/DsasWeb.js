// The javascript used by the DSAS web.html page
import { _ } from "./MultiLang";
import { modal_message, modal_errors, modal_action } from "./DsasModal";
import { fail_loggedin, clear_feedback } from "./DsasUtil";

function dsas_renew_cert_real() {
    fetch("api/dsas-web.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then(() => {
        const formData = new FormData();
        formData.append("op", "renew");
        ["countryName", "stateOrProvinceName", "localityName", "organizationName",
            "organizationalUnitName", "commonName", "emailAddress"].ForEach((fld) => {
            formData.append(fld, document.getElementById(fld).value);
        });
        let valid = 0;
        for (let i = 0; i <= 5; i += 1) {
            if (document.getElementById("valid" + i).selected) {
                valid = i;
                break;
            }
        }
        formData.append("validity", valid);

        fetch("api/dsas-web.php", { method: "POST", body: formData }).then((response) => {
            if (response.ok) { return response.text(); }
            return Promise.reject(new Error(response.statusText));
        }).then((text) => {
            try {
                const errors = JSON.parse(text);
                modal_errors(errors);
                // Circular referencing between these function is deliberate
                // eslint-disable-next-line no-use-before-define
                dsas_display_web("cert");
            } catch (e) {
            // Its text => here always just "Ok"
                clear_feedback();
                // eslint-disable-next-line no-use-before-define
                dsas_display_web("cert");
            }
        });
    }).catch((error) => {
        if (!fail_loggedin(error)) { modal_message(_("Error while loading the page : {0}", (error.message ? error.message : error))); }
    });
}

function dsas_renew_cert() {
    modal_action(
        _("Are you sure you want to renew the certificate ?"),
        () => { dsas_renew_cert_real(); },
        true,
    );
}

function dsas_upload_crt() {
    const crt = document.getElementById("crtupload");
    const formData = new FormData();
    formData.append("op", "upload");
    formData.append("file", crt[0].files[0]);

    fetch("api/dsas-web.php", {
        method: "POST",
        body: formData,
    }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modal_errors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clear_feedback();
            // eslint-disable-next-line no-use-before-define
            modal_message(_("CRT successfully uploaded"), () => { dsas_display_web("cert"); }, true);
        }
    }).catch((error) => {
        if (!fail_loggedin(error)) { modal_message(_("Error while loading the page : {0}", (error.message ? error.message : error))); }
    });
}

export default function dsas_display_web(what = "all") {
    fetch("api/dsas-web.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((web) => {
        if (what === "all" || what === "cert") {
            const csrblob = new Blob([web.ssl.csr], { type: "application/x-x509-user-cert" });
            const csrurl = window.URL.createObjectURL(csrblob);
            document.getElementById("csr_body").textContent = web.ssl.csr;
            document.getElementById("getcsr").setAttribute("href", csrurl);
            const pemblob = new Blob([web.ssl.pem], { type: "application/x-x509-user-cert" });
            const pemurl = window.URL.createObjectURL(pemblob);
            document.getElementById("pem_body").textContent = web.ssl.pem;
            document.getElementById("getpem").setAttribute("href", pemurl);
            ["countryName", "stateOrProvinceName", "localityName", "organizationName",
                "organizationalUnitName", "commonName", "emailAddress"].forEach((fld) => {
                if (Object.keys(web.ssl[fld]).length !== 0) { document.getElementById(fld).value = web.ssl[fld]; } else { document.getElementById(fld).value = ""; }
            });
            const validity = parseInt(web.ssl.validity, 10);
            for (let i = 1; i <= 5; i += 1) {
                if (validity === i) { document.getElementById("valid" + i).setAttribute("selected", ""); }
            }
            document.getElementById("web_renew2").addEventListener("click", () => { dsas_renew_cert(); return false; });
            document.getElementById("crtfile").addEventListener("change", dsas_upload_crt);
            document.getElementById("upload").addEventListener("click", () => { document.getElementById("crtfile").click(); return false; });
        }
    }).catch((error) => {
        if (!fail_loggedin(error)) { modal_message(_("Error while loading the page : {0}", (error.message ? error.message : error))); }
    });
}
