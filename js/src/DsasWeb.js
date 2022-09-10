// The javascript used by the DSAS web.html page

/* globals _ modal_message modal_errors modal_action clear_feedback fail_loggedin */

export default function dsas_display_web(what = "all") {
    fetch("api/dsas-web.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((web) => {
        if (what === "all" || what === "cert") {
            document.getElementById("web_csr").innerHTML = "  <h5><a class=\"text-toggle\" data-bs-toggle=\"collapse\" href=\"#csr\"\n"
                + "    role=\"button\" aria-controls=\"csr\" aria-expanded=\"false\"> \n"
                + "    <i class=\"text-collapsed\"><img src=\"caret-right.svg\"/></i><i class=\"text-expanded\">\n"
                + "    <img src=\"caret-down.svg\"/></i></a>" + _("Certificate Signing Request") + "\n"
                + "    <a data-toggle=\"tooltip\" title=\"" + _("Download") + "\" id=\"getcsr\" download=\"dsas.csr\"><img src=\"save.svg\"></a></h5>\n"
                + "  <div class=\"collapse\" id=\"csr\">\n"
                + "     <div class=\"card card-body\">\n"
                + "        <pre id=\"csr_body\" style=\"height : 300px\"></pre>\n"
                + "        <form id=\"crtupload\">\n"
                + "            <label for=\"upload\" data-toggle=\"tooltip\" title=\"" + _("CSR file signed by a CA") + "\">" + _("Upload CRT") + "</label>\n"
                + "            <input type=\"file\" name=\"crtfile\" id=\"crtfile\" style=\"display: none\"\n"
                + "              accept=\"text/plain,application/x-x509-user-cert\" onchange=\"dsas_upload_crt();\">\n"
                + "            <input type=\"submit\" class=\"btn btn-primary btn-sm\" name=\"upload\" value=\"" + _("Upload") + "\"\n"
                + "              onclick=\"document.getElementById('crtfile').click(); return false;\">\n"
                + "        </form></div></div>\n";

            const csrblob = new Blob([web.ssl.csr], { type: "application/x-x509-user-cert" });
            const csrurl = window.URL.createObjectURL(csrblob);
            document.getElementById("csr_body").innerHTML = web.ssl.csr;
            document.getElementById("getcsr").setAttribute("href", csrurl);

            document.getElementById("web_pem").innerHTML = "  <h5><a class=\"text-toggle\" data-bs-toggle=\"collapse\" href=\"#cert\"\n"
                + "    role=\"button\" aria-controls=\"cert\" aria-expanded=\"false\">\n"
                + "    <i class=\"text-collapsed\"><img src=\"caret-right.svg\"/></i><i class=\"text-expanded\">\n"
                + "    <img src=\"caret-down.svg\"/></i></a>" + _("Public Certificate")
                + "    <a data-toggle=\"tooltip\" title=\"" + _("Download") + "\" id=\"getpem\" download=\"dsas.crt\"><img src=\"save.svg\"></a></h5>\n"
                + "  <div class=\"collapse\" id=\"cert\">\n"
                + "    <div class=\"card card-body\">\n"
                + "      <pre id=\"pem_body\" style=\"height : 300px\"></pre>\n"
                + "    </div>\n"
                + "  </div>";
            const pemblob = new Blob([web.ssl.pem], { type: "application/x-x509-user-cert" });
            const pemurl = window.URL.createObjectURL(pemblob);
            document.getElementById("pem_body").innerHTML = web.ssl.pem;
            document.getElementById("getpem").setAttribute("href", pemurl);

            document.getElementById("web_renew").innerHTML = _("Renew certificate");
            document.getElementById("web_email").innerHTML = _("email");
            document.getElementById("web_validity").innerHTML = _("Validity");
            document.getElementById("web_renew2").value = _("Renew certificate");
            document.getElementById("validity").innerHTML = "<option id=\"valid0\" value=\"0\" selected>" + _("Years") + "</option>\n"
                + "<option id=\"valid1\" value=\"1\">" + _("One year") + "</option>\n"
                + "<option id=\"valid2\" value=\"2\">" + _("Two years") + "</option>\n"
                + "<option id=\"valid3\" value=\"3\">" + _("Three years") + "</option>\n"
                + "<option id=\"valid4\" value=\"4\">" + _("Four years") + "</option>\n"
                + "<option id=\"valid5\" value=\"5\">" + _("Five years") + "</option>\n";

            ["countryName", "stateOrProvinceName", "localityName", "organizationName",
                "organizationalUnitName", "commonName", "emailAddress"].forEach((fld) => {
                if (Object.keys(web.ssl[fld]).length !== 0) { document.getElementById(fld).value = web.ssl[fld]; } else { document.getElementById(fld).value = ""; }
            });
            const validity = parseInt(web.ssl.validity, 10);
            for (let i = 1; i <= 5; i += 1) {
                if (validity === i) { document.getElementById("valid" + i).setAttribute("selected", ""); }
            }
        }
    }).catch((error) => {
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error while loading the page : {0}", (error.statusText ? error.statusText : error))); }
    });
}
window.dsas_display_web = dsas_display_web;

export function dsas_renew_cert() {
    modal_action(
        _("Are you sure you want to renew the certificate ?"),
        "dsas_renew_cert_real();",
        true,
    );
}
window.dsas_renew_cert = dsas_renew_cert;

export function dsas_renew_cert_real() {
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
                dsas_display_web("cert");
            } catch (e) {
            // Its text => here always just "Ok"
                clear_feedback();
                dsas_display_web("cert");
            }
        });
    }).catch((error) => {
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error while loading the page : {0}", (error.statusText ? error.statusText : error))); }
    });
}
window.dsas_renew_cert_real = dsas_renew_cert_real;

export function dsas_upload_crt() {
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
            modal_message(_("CRT successfully uploaded"), "dsas_display_web('cert');", true);
        }
    }).catch((error) => {
        if (!fail_loggedin(error.statusText)) { modal_message(_("Error while loading the page : {0}", (error.statusText ? error.statusText : error))); }
    });
}
window.dsas_upload_crt = dsas_upload_crt;
