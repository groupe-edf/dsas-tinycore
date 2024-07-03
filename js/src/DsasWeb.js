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

// The javascript used by the DSAS web.html page
import { _ } from "./MultiLang";
import { modalMessage, modalErrors, modalAction } from "./DsasModal";
import { failLoggedin, clearFeedback } from "./DsasUtil";

function dsasRenewCertReal() {
    fetch("api/v2/web").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then(() => {
        const formData = new FormData();
        ["countryName", "stateOrProvinceName", "localityName", "organizationName",
            "organizationalUnitName", "commonName", "emailAddress"].forEach((fld) => {
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

        fetch("api/v2/web/renew", { method: "POST", body: formData }).then((response) => {
            if (response.ok) { return response.json(); }
            return Promise.reject(new Error(response.statusText));
        }).then((json) => {
            if (Object.prototype.hasOwnProperty.call(json, "retval")) {
                clearFeedback();
                // eslint-disable-next-line no-use-before-define
                modalMessage(_("Certificate successfully renewed"), () => { dsasDisplayWeb("cert"); }, true);
            } else {
                modalErrors(json);
                // Circular referencing between these function is deliberate
                // eslint-disable-next-line no-use-before-define
                dsasDisplayWeb("cert");
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
    formData.append("file", crt[0].files[0]);

    fetch("api/v2/web/upload", {
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
    fetch("api/v2/web").then((response) => {
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
