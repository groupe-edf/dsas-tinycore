// DSAS entry point
import "./dsas.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle";
import "./DsasHeader";
import { dsas_loggedin, dsas_check_warnings } from "./DsasUtil";
import { dsas_status, dsas_display_logs } from "./DsasStatus"; // For the "index.html" page
import dsas_init_loggedin from "./DsasLogin"; // For the "login.html" page
import dsas_display_passwd from "./DsasPasswd"; // For the "passwd.html" page
import dsas_display_users from "./DsasUsers"; // For the "users.html" page

// Main initialisation code
let page = String(window.location).substring(String(window.location).lastIndexOf("/") + 1);
if (page.indexOf("?") > 0) page = page.substring(0, page.indexOf("?"));

export default function dsas_entry(_page = null) {
    switch ((_page ? _page : page)) {
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
