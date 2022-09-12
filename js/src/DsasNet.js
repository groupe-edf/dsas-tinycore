// The javascript used by the DSAS service.html page
import { _ } from "./MultiLang";
import { modal_message, modal_errors } from "./DsasModal";
import {
    fail_loggedin,
    clear_feedback,
    print_obj,
    empty_obj,
} from "./DsasUtil";

function iface_body(iface, i) {
    const dhcp = (iface.dhcp === "true");

    return "<div class=\"row\">\n"
        + "  <div class=\"col-6\">\n"
        + "    <div class=\"row\">\n"
        + "      <div class=\"col-12\">\n"
        + "        <input class=\"form-check-input\" type=\"checkbox\"" + (dhcp ? " checked=\"\"" : "") + " id=\"iface_dhcp" + i
        + "\" onchange=\"dsas_change_net('dhcp', " + i + ");\">\n"
        + "        <label class=\"form-check-label\" for=\"iface_dhcp" + i + "\">" + _("Use DHCP") + "</label>\n"
        + "      </div>\n"
        + "      <div class=\"col-12\">\n"
        + "        <label for=\"iface_cidr" + i + "\">" + _("IP address and mask (CIDR format)") + "</label>\n"
        + "        <input type=\"text\" id=\"iface_cidr" + i + "\"" + (dhcp ? " disabled=\"\"" : "") + " value=\"" + print_obj(iface.cidr) + "\" class=\"form-control\">\n"
        + "        <div class=\"invalid-feedback\" id=\"feed_iface_cidr" + i + "\"></div>\n"
        + "      </div>\n"
        + "      <div class=\"col-12\">\n"
        + "        <label for=\"iface_gateway" + i + "\">" + _("Gateway") + "</label>\n"
        + "        <input type=\"text\" id=\"iface_gateway" + i + "\"" + (dhcp ? " disabled=\"\"" : "") + " value=\"" + print_obj(iface.gateway) + "\" class=\"form-control\">\n"
        + "        <div class=\"invalid-feedback\" id=\"feed_iface_gateway" + i + "\"></div>\n"
        + "      </div>\n"
        + "    </div>\n"
        + "  </div>\n"
        + "  <div class=\"col-6\">\n"
        + "    <div class=\"row\">\n"
        + "      <div class=\"col-12\">\n"
        + "        <label for=\"iface_dns_domain" + i + "\">" + _("DNS domain") + "</label>\n"
        + "        <input type=\"text\" id=\"iface_dns_domain" + i + "\"" + (dhcp ? " disabled=\"\"" : "") + " value=\"" + print_obj(iface.dns.domain) + "\" class=\"form-control\">\n"
        + "        <div class=\"invalid-feedback\" id=\"feed_iface_dns_domain" + i + "\"></div>\n"
        + "      </div>\n"
        + "      <div class=\"form-check col-12\">\n"
        + "        <label for=\"iface_nameserver" + i + "\">" + _("DNS name servers") + "</label>\n"
        + "        <textarea name=\"iface_nameserver" + i + "\"" + (dhcp ? " disabled=\"\"" : "") + " rows=\"3\" id=\"iface_nameserver" + i + "\" class=\"form-control\"></textarea>\n"
        + "        <div class=\"invalid-feedback\" id=\"feed_iface_nameserver" + i + "\"></div>\n"
        + "      </div>\n"
        + "    </div>\n"
        + "  </div>\n"
        + "</div>";
}

export default function dsas_display_net(what = "all") {
    fetch("api/dsas-net.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((net) => {
        if (what === "ifaces" || what === "all") {
            let i = 0;
            let iface;
            let body = "<h5>" + _("Network configuration") + "</h5>\n"
                + "<form class=\"row g-2\">\n"
                + "  <div class=\"container p-3 my-3 border\" id=\"IFaces\">";
            ["bas", "haut"].forEach((iface2) => {
                iface = net[iface2];
                body += "<p class=\"my-0\"><a class=\"text-toggle\" data-bs-toggle=\"collapse\" href=\"#iface" + i
                    + "\" role=\"button\" aria-controls=\"iface" + i + "\" aria-expanded=\"false\">"
                    + "<i class=\"text-collapsed\"><img src=\"caret-right.svg\"/></i>"
                    + "<i class=\"text-expanded\"><img src=\"caret-down.svg\"/></i></a>"
                    + (iface2 === "bas" ? _("Lower Machine") : _("Upper Machine"));
                body += "</p><div class=\"collapse\" id=\"iface" + i + "\"><div class=\"card card-body\">"
                    + iface_body(iface, i) + "</div></div>\n";
                i += 1;
            });
            body += "</div><div class=\"form-group\">\n"
                + "  <input type=\"submit\" class=\"btn btn-primary\" value=\"" + _("Save the changes") + "\" onclick=\"dsas_change_net(); return false;\">\n"
                + "</div></form>";

            document.getElementById("network").innerHTML = body;

            // Why can't I include this in the declaration of the body ?
            i = 0;
            [net.bas, net.haut].forEach((iface2) => {
                let dns_servers = "";
                if (!empty_obj(iface2.dns.nameserver)) {
                    (iface2.dns.nameserver.constructor === Array
                        ? iface2.dns.nameserver : [iface2.dns.nameserver]).forEach((ns) => {
                        dns_servers += ns + "\n";
                    });
                }
                document.getElementById("iface_nameserver" + i).value = dns_servers;
                i += 1;
            });
        }
    }).catch((error) => {
        if (!fail_loggedin(error.statusText)) {
            modal_message(_("Error while loading the page : {0}", (error.statusText ? error.statusText : error)));
        }
    });
}
window.dsas_display_net = dsas_display_net;

export function dsas_change_net(what = "all", i = 0) {
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
                    dsas_display_net("all");
                }
            }).catch((error) => {
                modal_message(_("Error while loading the page : {0}", (error.statusText ? error.statusText : error)));
            });
        }).catch((error) => {
            fail_loggedin(error.statusText);
        });
    }
}
window.dsas_change_net = dsas_change_net;
