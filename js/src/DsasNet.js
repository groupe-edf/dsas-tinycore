// The javascript used by the DSAS service.html page
import { _ } from "./MultiLang";
import { modal_message, modal_errors } from "./DsasModal";
import {
    fail_loggedin,
    clear_feedback,
    print_obj,
    empty_obj,
} from "./DsasUtil";

function dsas_change_net(what = "all", i = 0) {
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
                    modal_errors(errors, true);
                } catch (e) {
                    // Its text => here always just "Ok"
                    clear_feedback();
                    /* eslint-disable-next-line no-use-before-define */
                    dsas_display_net("ifaces");
                }
            }).catch((error) => {
                modal_message(_("Error while loading the page : {0}", (error.message ? error.message : error)));
            });
        }).catch((error) => {
            fail_loggedin(error);
        });
    }
}

export default function dsas_display_net(what = "all") {
    fetch("api/dsas-net.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((net) => {
        let i = 0;
        ["bas", "haut"].forEach((iface2) => {
            const iface = net[iface2];
            const dhcp = (iface.dhcp === "true");
            let dns_servers = "";
            document.getElementById("iface_dhcp" + i).setAttribute("checked", "");
            if (what === "all") {
                const fn = (function (j) { return function () { dsas_change_net("dhcp", j); }; }(i));
                document.getElementById("iface_dhcp" + i).addEventListener("change", fn);
            }
            document.getElementById("iface_cidr" + i).disabled = dhcp;
            document.getElementById("iface_cidr" + i).value = print_obj(iface.cidr);
            document.getElementById("iface_gateway" + i).disabled = dhcp;
            document.getElementById("iface_gateway" + i).value = print_obj(iface.gateway);
            document.getElementById("iface_dns_domain" + i).disabled = dhcp;
            document.getElementById("iface_dns_domain" + i).value = print_obj(iface.dns.domain);
            document.getElementById("iface_nameserver" + i).disabled = dhcp;
            if (!empty_obj(iface.dns.nameserver)) {
                (iface.dns.nameserver.constructor === Array
                    ? iface.dns.nameserver : [iface.dns.nameserver]).forEach((ns) => {
                    dns_servers += ns + "\n";
                });
            }
            document.getElementById("iface_nameserver" + i).value = dns_servers;
            i += 1;
        });
        if (what === "all") {
            document.getElementById("netsubmit").addEventListener("click", () => { dsas_change_net(); });
        }
    }).catch((error) => {
        if (!fail_loggedin(error)) {
            modal_message(_("Error while loading the page : {0}", (error.message ? error.message : error)));
        }
    });
}
