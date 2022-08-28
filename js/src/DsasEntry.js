// DSAS entry point
import "./dsas.css";
import "./github-markdown.min.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle";
import "./DsasHeader";
import { dsas_loggedin, dsas_check_warnings } from "./DsasUtil";
import { dsas_status, dsas_display_logs } from "./DsasStatus";
import dsas_init_loggedin from "./DsasLogin"; // For the "login.html" page
import dsas_display_passwd from "./DsasPasswd"; // For the "passwd.html" page

// Main initialisation code
let page = String(window.location).substring(String(window.location).lastIndexOf("/") + 1);
if (page.indexOf("?") > 0) page = page.substring(0, page.indexOf("?"));

switch (page) {
case "login.html":
    dsas_init_loggedin();
    break;
case "passwd.html":
    dsas_loggedin(true, false);
    dsas_display_passwd();
    break;
default:
    // Assume on "index.html"
    dsas_loggedin();
    dsas_check_warnings();
    dsas_status();
    dsas_display_logs("all");
    break;
}
