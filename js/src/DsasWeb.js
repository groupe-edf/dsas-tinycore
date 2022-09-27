// The javascript used by the DSAS web.html page
import { _ } from "./MultiLang";
import { modalMessage, modalErrors, modalAction } from "./DsasModal";
import { failLoggedin, clearFeedback } from "./DsasUtil";

function dsasRenewCertReal() {
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
                modalErrors(errors);
                // Circular referencing between these function is deliberate
                // eslint-disable-next-line no-use-before-define
                dsasDisplayWeb("cert");
            } catch (e) {
            // Its text => here always just "Ok"
                clearFeedback();
                // eslint-disable-next-line no-use-before-define
                modalMessage(_("Certificate successfully renewed"), () => { dsasDisplayWeb("cert"); }, true);
            }
        });
    }).catch((error) => {
        if (!failLoggedin(error)) { modalMessage(_("Error while loading the page : {0}", (error.message ? error.message : error))); }
    });
}

function dsasRenewCert() {
    modalAction(_("Are you sure you want to renew the certificate ?"), dsasRenewCertReal, true);
}

function dsasUploadCrt() {
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
            modalErrors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clearFeedback();
            // eslint-disable-next-line no-use-before-define
            modalMessage(_("CRT successfully uploaded"), () => { dsasDisplayWeb("cert"); }, true);
        }
    }).catch((error) => {
        if (!failLoggedin(error)) { modalMessage(_("Error while loading the page : {0}", (error.message ? error.message : error))); }
    });
}

export default function dsasDisplayWeb(what = "all") {
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
            document.getElementById("web_renew2").addEventListener("click", () => { dsasRenewCert(); return false; });
            document.getElementById("crtfile").addEventListener("change", dsasUploadCrt);
            document.getElementById("upload").addEventListener("click", () => { document.getElementById("crtfile").click(); return false; });
        }
    }).catch((error) => {
        if (!failLoggedin(error)) { modalMessage(_("Error while loading the page : {0}", (error.message ? error.message : error))); }
    });
}
