// DSAS entry point
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle";
import "./DsasHeader";
import { dsas_loggedin, dsas_check_warnings } from "./DsasUtil";
import { dsas_status, dsas_display_logs } from "./DsasStatus"; // For the "index.html" page
import dsas_init_loggedin from "./DsasLogin"; // For the "login.html" page
import dsas_display_passwd from "./DsasPasswd"; // For the "passwd.html" page
import dsas_display_users from "./DsasUsers"; // For the "users.html" page
import dsas_display_help from "./DsasHelp"; // For the "help.html" page
import dsas_display_cert from "./DsasCert"; // For the "cert.html" page
import dsas_display_net from "./DsasNet"; // For the "net.html" page
import dsas_display_service from "./DsasService"; // For the "service.html" page
import dsas_display_tasks from "./DsasTask"; // For the "tasks.html" page
import dsas_display_web from "./DsasWeb"; // For the "web.html" page

// Main initialisation code
export default function dsas_entry(_page = null) {
    let page;
    if (_page) {
        page = _page;
    } else {
        page = String(window.location).substring(String(window.location).lastIndexOf("/") + 1);
        if (page.indexOf("?") > 0) page = page.substring(0, page.indexOf("?"));
    }
    switch (page) {
    case "help.html":
        dsas_loggedin();
        dsas_check_warnings();
        dsas_display_help();
        break;
    case "cert.html":
        dsas_loggedin();
        dsas_check_warnings();
        dsas_display_cert();
        break;
    case "net.html":
        dsas_loggedin();
        dsas_check_warnings();
        dsas_display_net("all");
        break;
    case "service.html":
        dsas_loggedin();
        dsas_check_warnings();
        dsas_display_service("all");
        break;
    case "tasks.html":
        dsas_loggedin();
        dsas_check_warnings();
        dsas_display_tasks();
        break;
    case "web.html":
        dsas_loggedin();
        dsas_check_warnings();
        dsas_display_web("all");
        break;
    case "login.html":
        dsas_init_loggedin();
        break;
    case "passwd.html":
        dsas_loggedin(true, false);
        dsas_display_passwd();
        break;
    case "users.html":
        dsas_loggedin();
        dsas_loggedin(true, false);
        dsas_display_users();
        break;
    default:
        // Assume on "index.html"
        dsas_loggedin();
        dsas_check_warnings();
        dsas_status();
        dsas_display_logs("all");
        break;
    }
}
window.dsas_entry = dsas_entry;
