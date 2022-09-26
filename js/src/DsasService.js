// The javascript used by the DSAS service.html page
import { _ } from "./MultiLang";
import { modalMessage, modalErrors } from "./DsasModal";
import {
    failLoggedin,
    clearFeedback,
    printObj,
    emptyObj,
} from "./DsasUtil";

function dsasChangeService(what) {
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
            if (document.getElementById("radius")) {
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
            [...document.getElementsByTagName("option")].forEach((opt) => {
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
            [...document.getElementsByTagName("option")].forEach((opt) => {
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
                    modalErrors(errors, true);
                } catch (e) {
                    // Its text => here always just "Ok"
                    clearFeedback();
                    modalMessage(_("Changes successfully saved"));
                }
            }).catch((error) => {
                modalMessage(_("Error : {0}", (error.message ? error.message : error)));
            });
        }).catch((error) => {
            failLoggedin(error);
        });
    }
}

export default function dsasDisplayService(what = "all") {
    fetch("api/dsas-service.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((serv) => {
        if (what === "ssh" || what === "all") {
            document.getElementById("ssh").checked = (serv.ssh.active === "true");
            document.getElementById("user_tc").value = printObj(serv.ssh.user_tc);
            document.getElementById("user_tc").disabled = (serv.ssh.active !== "true");
            document.getElementById("user_bas").value = printObj(serv.ssh.user_bas);
            document.getElementById("user_bas").disabled = (serv.ssh.active !== "true");
            document.getElementById("user_haut").value = printObj(serv.ssh.user_haut);
            document.getElementById("user_haut").disabled = (serv.ssh.active !== "true");
        }
        if (what === "radius" || what === "all") {
            if (!emptyObj(document.getElementById("radius"))) {
                // FIXME : The test above allows the radius code to be commented in service.htmls
                if (emptyObj(serv.radius)) {
                    // This allow me to not have to artificially upgrade the XML file version
                    document.getElementById("radius").checked = false;
                    document.getElementById("radius_server").disabled = true;
                    document.getElementById("radius_secret").disabled = true;
                } else {
                    document.getElementById("radius").checked = (serv.radius.active === "true");
                    document.getElementById("radius_server").value = printObj(serv.radius.server);
                    document.getElementById("radius_server").disabled = (serv.radius.active !== "true");
                    document.getElementById("radius_secret").value = printObj(serv.radius.secret);
                    document.getElementById("radius_secret").disabled = (serv.radius.active !== "true");
                }
            }
        }
        if (what === "syslog" || what === "all") {
            document.getElementById("syslog").checked = (serv.syslog.active === "true");
            document.getElementById("syslog_server").value = printObj(serv.syslog.server);
            document.getElementById("syslog_server").disabled = (serv.syslog.active !== "true");
        }
        if (what === "ntp" || what === "all") {
            let pool = "";
            if (!emptyObj(serv.ntp.server)) {
                (serv.ntp.server.constructor === Array
                    ? serv.ntp.server : [serv.ntp.server]).forEach((s) => { pool = pool + s + "\n"; });
            }
            document.getElementById("ntp").checked = (serv.ntp.active === "true");
            document.getElementById("ntp_pool").value = pool;
            document.getElementById("ntp_pool").disabled = (serv.ntp.active !== "true");
        }
        if (what === "antivirus" || what === "all") {
            document.getElementById("antivirus").checked = (serv.antivirus.active === "true");
            document.getElementById("antivirus_uri").value = printObj(serv.antivirus.uri);
            document.getElementById("antivirus_uri").disabled = (serv.antivirus.active !== "true");
        }
        if (what === "repo" || what === "all") {
            document.getElementById("repo").checked = (serv.web.repo === "true");
        }
        if (what === "snmp" || what === "all") {
            document.getElementById("snmp").checked = (serv.snmp.active === "true");
            document.getElementById("snmp_user").value = printObj(serv.snmp.username);
            document.getElementById("snmp_user").disabled = (serv.snmp.active !== "true");
            document.getElementById("snmp_pass").value = printObj(serv.snmp.password);
            document.getElementById("snmp_pass").disabled = (serv.snmp.active !== "true");
            document.getElementById("snmp_encrypt").value = printObj(serv.snmp.encrypt);
            document.getElementById("snmp_encrypt").disabled = (serv.snmp.active !== "true");
            document.getElementById("snmp_passpriv").value = printObj(serv.snmp.passpriv);
            document.getElementById("snmp_passpriv").disabled = (serv.snmp.active !== "true");
            document.getElementById("snmp_privencrypt").value = printObj(serv.snmp.privencrypt);
            document.getElementById("snmp_privencrypt").disabled = (serv.snmp.active !== "true");
        }
        if (what === "all") {
            document.getElementById("ssh").addEventListener("change", () => { dsasChangeService("ssh"); });
            document.getElementById("snmp").addEventListener("change", () => { dsasChangeService("snmp"); });
            document.getElementById("syslog").addEventListener("change", () => { dsasChangeService("syslog"); });
            document.getElementById("ntp").addEventListener("change", () => { dsasChangeService("ntp"); });
            document.getElementById("antivirus").addEventListener("change", () => { dsasChangeService("antivirus"); });
            document.getElementById("repo").addEventListener("change", () => { dsasChangeService("repo"); });
            // This has a test as the radius code is deactivate in the html. Simply uncommenting
            // the html code shoudld activate this code if needed
            if (document.getElementById("radius")) {
                document.getElementById("radius").addEventListener("change", () => { dsasChangeService("radius"); });
            }
            document.getElementById("save").addEventListener("click", () => { dsasChangeService(); return false; });
        }
    }).catch((error) => {
        failLoggedin(error);
    });
}
