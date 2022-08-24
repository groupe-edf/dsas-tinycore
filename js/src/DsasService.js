// The javascript used by the DSAS service.html page

/* globals _ modal_message modal_errors clear_feedback fail_loggedin print_obj empty_obj */

export function dsas_display_service(what = "all") {
    fetch("api/dsas-service.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((serv) => {
        if (what === "ssh" || what === "all") {
            document.getElementById("ssh").checked = (serv.ssh.active === "true");
            document.getElementById("user_tc").value = print_obj(serv.ssh.user_tc);
            document.getElementById("user_tc").disabled = (serv.ssh.active !== "true");
            document.getElementById("user_bas").value = print_obj(serv.ssh.user_bas);
            document.getElementById("user_bas").disabled = (serv.ssh.active !== "true");
            document.getElementById("user_haut").value = print_obj(serv.ssh.user_haut);
            document.getElementById("user_haut").disabled = (serv.ssh.active !== "true");
        }
        if (what === "radius" || what === "all") {
            if (!empty_obj(document.getElementById("radius"))) {
                // FIXME : The test above allows the radius code to be commented in service.htmls
                if (empty_obj(serv.radius)) {
                    // This allow me to not have to artificially upgrade the XML file version
                    document.getElementById("radius").checked = false;
                    document.getElementById("radius_server").disabled = true;
                    document.getElementById("radius_secret").disabled = true;
                } else {
                    document.getElementById("radius").checked = (serv.radius.active === "true");
                    document.getElementById("radius_server").value = print_obj(serv.radius.server);
                    document.getElementById("radius_server").disabled = (serv.radius.active !== "true");
                    document.getElementById("radius_secret").value = print_obj(serv.radius.secret);
                    document.getElementById("radius_secret").disabled = (serv.radius.active !== "true");
                }
            }
        }
        if (what === "syslog" || what === "all") {
            document.getElementById("syslog").checked = (serv.syslog.active === "true");
            document.getElementById("syslog_server").value = print_obj(serv.syslog.server);
            document.getElementById("syslog_server").disabled = (serv.syslog.active !== "true");
        }
        if (what === "ntp" || what === "all") {
            let pool = "";
            if (!empty_obj(serv.ntp.server)) {
                (serv.ntp.server.constructor === Array
                    ? serv.ntp.server : [serv.ntp.server]).forEach((s) => { pool = pool + s + "\n"; });
            }
            document.getElementById("ntp").checked = (serv.ntp.active === "true");
            document.getElementById("ntp_pool").value = pool;
            document.getElementById("ntp_pool").disabled = (serv.ntp.active !== "true");
        }
        if (what === "antivirus" || what === "all") {
            document.getElementById("antivirus").checked = (serv.antivirus.active === "true");
            document.getElementById("antivirus_uri").value = print_obj(serv.antivirus.uri);
            document.getElementById("antivirus_uri").disabled = (serv.antivirus.active !== "true");
        }
        if (what === "repo" || what === "all") {
            document.getElementById("repo").checked = (serv.web.repo === "true");
        }
        if (what === "snmp" || what === "all") {
            document.getElementById("snmp").checked = (serv.snmp.active === "true");
            document.getElementById("snmp_user").value = print_obj(serv.snmp.username);
            document.getElementById("snmp_user").disabled = (serv.snmp.active !== "true");
            document.getElementById("snmp_pass").value = print_obj(serv.snmp.password);
            document.getElementById("snmp_pass").disabled = (serv.snmp.active !== "true");
            document.getElementById("snmp_encrypt").value = print_obj(serv.snmp.encrypt);
            document.getElementById("snmp_encrypt").disabled = (serv.snmp.active !== "true");
            document.getElementById("snmp_passpriv").value = print_obj(serv.snmp.passpriv);
            document.getElementById("snmp_passpriv").disabled = (serv.snmp.active !== "true");
            document.getElementById("snmp_privencrypt").value = print_obj(serv.snmp.privencrypt);
            document.getElementById("snmp_privencrypt").disabled = (serv.snmp.active !== "true");
        }
    }).catch((error) => {
        fail_loggedin(error.statusText);
    });
}
window.dsas_display_service = dsas_display_service;

export function dsas_change_service(what) {
    if (what === "ssh") {
        const nchk = !document.getElementById("ssh").checked;
        document.getElementById("user_tc").disabled = nchk;
        document.getElementById("user_bas").disabled = nchk;
        document.getElementById("user_haut").disabled = nchk;
    } else if (what === "radius") {
        const nchk = !document.getElementById("radius").checked;
        document.getElementById("radius_server").disabled = nchk;
        document.getElementById("radius_secret").disabled = nchk;
    } else if (what === "syslog") {
        document.getElementById("syslog_server").disabled = !document.getElementById("syslog").checked;
    } else if (what === "ntp") {
        document.getElementById("ntp_pool").disabled = !document.getElementById("ntp").checked;
    } else if (what === "antivirus") {
        document.getElementById("antivirus_uri").disabled = !document.getElementById("antivirus").checked;
    } else if (what === "snmp") {
        const nchk = !document.getElementById("snmp").checked;
        document.getElementById("snmp_user").disabled = nchk;
        document.getElementById("snmp_pass").disabled = nchk;
        document.getElementById("snmp_encrypt").disabled = nchk;
        document.getElementById("snmp_passpriv").disabled = nchk;
        document.getElementById("snmp_privencrypt").disabled = nchk;
    } else if (what !== "repo") {
        fetch("api/dsas-service.php").then((response) => {
            if (response.ok) { return response.json(); }
            return Promise.reject(new Error(response.statusText));
        }).then((srv) => {
            const serv = srv; // Keep eslint happy
            serv.ssh.active = (document.getElementById("ssh").checked ? "true" : "false");
            serv.ssh.user_tc = document.getElementById("user_tc").value;
            serv.ssh.user_bas = document.getElementById("user_bas").value;
            serv.ssh.user_haut = document.getElementById("user_haut").value;
            if (!serv.radius) { serv.radius = {}; }
            if (!empty_obj(document.getElementById("radius"))) {
                serv.radius.active = (document.getElementById("radius").checked ? "true" : "false");
                serv.radius.server = document.getElementById("radius_server").value;
                serv.radius.secret = document.getElementById("radius_secret").value;
            } else {
                serv.radius.active = "false";
                serv.radius.server = "";
                serv.radius.secret = "";
            }
            serv.syslog.active = (document.getElementById("syslog").checked ? "true" : "false");
            serv.syslog.server = document.getElementById("syslog_server").value;
            serv.ntp.active = (document.getElementById("ntp").checked ? "true" : "false");
            serv.web.repo = (document.getElementById("repo").checked ? "true" : "false");

            serv.snmp.active = (document.getElementById("snmp").checked ? "true" : "false");
            serv.snmp.username = document.getElementById("snmp_user").value;
            serv.snmp.password = document.getElementById("snmp_pass").value;
            document.getElementsByTagName("option").forEach((opt) => {
                switch (opt.id) {
                case "snmp_md5":
                case "snmp_sha":
                case "snmp_sha256":
                case "snmp_sha512":
                    if (opt.selected) { serv.snmp.encrypt = opt.value; }
                    break;
                default:
                    break;
                }
            });
            serv.snmp.passpriv = document.getElementById("snmp_passpriv").value;
            document.getElementsByTagName("option").forEach((opt) => {
                switch (opt.id) {
                case "snmp_des":
                case "snmp_aes":
                case "snmp_aes192":
                case "snmp_aes192c":
                case "snmp_aes256":
                case "snmp_aes256c":
                    if (opt.selected) { serv.snmp.privencrypt = opt.value; }
                    break;
                default:
                    break;
                }
            });

            const server = [];
            document.getElementById("ntp_pool").value.split(/((\r?\n)|(\r\n?))/).forEach((s) => {
                const s2 = (s ? s.trim() : "");
                if (s2) { server.push(s2); }
            });
            serv.ntp.server = server;
            serv.antivirus.active = (document.getElementById("antivirus").checked ? "true" : "false");
            serv.antivirus.uri = document.getElementById("antivirus_uri").value;

            const formData = new FormData();
            formData.append("op", "all");
            formData.append("data", JSON.stringify(serv));
            fetch("api/dsas-service.php", { method: "POST", body: formData }).then((response) => {
                if (response.ok) { return response.text(); }
                return Promise.reject(new Error(response.statusText));
            }).then((text) => {
                try {
                    const errors = JSON.parse(text);
                    modal_errors(errors, true);
                } catch (e) {
                    // Its text => here always just "Ok"
                    clear_feedback();
                    modal_message(_("Changes successfully saved"));
                }
            }).catch((error) => {
                modal_message(_("Error : {0}", (error.statusText ? error.statusText : error)));
            });
        }).catch((error) => {
            fail_loggedin(error.statusText);
        });
    }
}
window.dsas_change_service = dsas_change_service;
