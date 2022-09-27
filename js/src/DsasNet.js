// The javascript used by the DSAS service.html page
import { _ } from "./MultiLang";
import { modalMessage, modalErrors } from "./DsasModal";
import {
    failLoggedin,
    clearFeedback,
    printObj,
    emptyObj,
} from "./DsasUtil";

function dsasChangeNet(what = "all", i = 0) {
    if (what === "dhcp") {
        const chk = document.getElementById("iface_dhcp" + i).checked;
        document.getElementById("iface_cidr" + i).disabled = chk;
        document.getElementById("iface_gateway" + i).disabled = chk;
        document.getElementById("iface_dns_domain" + i).disabled = chk;
        document.getElementById("iface_nameserver" + i).disabled = chk;
    } else {
        fetch("api/dsas-net.php").then((response) => {
            if (response.ok) { return response.json(); }
            return Promise.reject(new Error(response.statusText));
        }).then((net) => {
            let j = 0;
            ["bas", "haut"].forEach((iface2) => {
                const iface = net[iface2];
                iface.dhcp = (document.getElementById("iface_dhcp" + j).checked ? "true" : "false");
                iface.cidr = document.getElementById("iface_cidr" + j).value;
                iface.gateway = document.getElementById("iface_gateway" + j).value;
                iface.dns.domain = document.getElementById("iface_dns_domain" + j).value;
                const server = [];
                document.getElementById("iface_nameserver" + j).value.split(/((\r?\n)|(\r\n?))/).forEach((s) => {
                    const s2 = (s ? s.trim() : "");
                    if (s2) { server.push(s2); }
                });
                iface.dns.nameserver = server;
                j += 1;
            });

            const formData = new FormData();
            formData.append("op", "all");
            formData.append("data", JSON.stringify(net));
            fetch("api/dsas-net.php", { method: "POST", body: formData }).then((response) => {
                if (response.ok) { return response.text(); }
                return Promise.reject(new Error(response.statusText));
            }).then((text) => {
                try {
                    const errors = JSON.parse(text);
                    modalErrors(errors, true);
                } catch (e) {
                    // Its text => here always just "Ok"
                    clearFeedback();
                    /* eslint-disable-next-line no-use-before-define */
                    modalMessage(_("Changes successfully saved"), () => { dsasDisplayNet("ifaces"); }, true);
                }
            }).catch((error) => {
                modalMessage(_("Error while loading the page : {0}", (error.message ? error.message : error)));
            });
        }).catch((error) => {
            failLoggedin(error);
        });
    }
}

export default function dsasDisplayNet(what = "all") {
    fetch("api/dsas-net.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((net) => {
        let i = 0;
        ["bas", "haut"].forEach((iface2) => {
            const iface = net[iface2];
            const dhcp = (iface.dhcp === "true");
            let dnsServers = "";
            if (dhcp) document.getElementById("iface_dhcp" + i).setAttribute("checked", "");
            if (what === "all") {
                const fn = (function _dhcp_(j) { return function _dhcp() { dsasChangeNet("dhcp", j); }; }(i));
                document.getElementById("iface_dhcp" + i).addEventListener("change", fn);
            }
            document.getElementById("iface_cidr" + i).disabled = dhcp;
            document.getElementById("iface_cidr" + i).value = printObj(iface.cidr);
            document.getElementById("iface_gateway" + i).disabled = dhcp;
            document.getElementById("iface_gateway" + i).value = printObj(iface.gateway);
            document.getElementById("iface_dns_domain" + i).disabled = dhcp;
            document.getElementById("iface_dns_domain" + i).value = printObj(iface.dns.domain);
            document.getElementById("iface_nameserver" + i).disabled = dhcp;
            if (!emptyObj(iface.dns.nameserver)) {
                (iface.dns.nameserver.constructor === Array
                    ? iface.dns.nameserver : [iface.dns.nameserver]).forEach((ns) => {
                    dnsServers += ns + "\n";
                });
            }
            document.getElementById("iface_nameserver" + i).value = dnsServers;
            i += 1;
        });
        if (what === "all") {
            document.getElementById("netsubmit").addEventListener("click", dsasChangeNet);
        }
    }).catch((error) => {
        if (!failLoggedin(error)) {
            modalMessage(_("Error while loading the page : {0}", (error.message ? error.message : error)));
        }
    });
}
