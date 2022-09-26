// DSAS entry point
import "../scss/styles.scss";
// eslint-disable-next-line no-unused-vars
import * as bootstrap from "bootstrap";
import "./DsasHeader";
import { dsas_loggedin, dsas_check_warnings } from "./DsasUtil";
import dsas_init_loggedin from "./DsasLogin"; // For the "login.html" page
import dsas_display_status from "./DsasStatus"; // For the "index.html" page
import dsas_display_passwd from "./DsasPasswd"; // For the "passwd.html" page
import dsas_display_users from "./DsasUsers"; // For the "users.html" page
import dsas_display_help from "./DsasHelp"; // For the "help.html" page
import dsas_display_cert from "./DsasCert"; // For the "cert.html" page
import dsas_display_net from "./DsasNet"; // For the "net.html" page
import dsas_display_service from "./DsasService"; // For the "service.html" page
import dsas_display_tasks from "./DsasTask"; // For the "tasks.html" page
import dsas_display_web from "./DsasWeb"; // For the "web.html" page

// Main initialisation code
switch (document.title) {
case "Help":
    dsas_loggedin();
    dsas_check_warnings();
    dsas_display_help();
    break;
case "Certificates":
    dsas_loggedin();
    dsas_check_warnings();
    dsas_display_cert();
    break;
case "Net":
    dsas_loggedin();
    dsas_check_warnings();
    dsas_display_net("all");
    break;
case "Service":
    dsas_loggedin();
    dsas_check_warnings();
    dsas_display_service("all");
    break;
case "Tasks":
    dsas_loggedin();
    dsas_check_warnings();
    dsas_display_tasks();
    break;
case "Web":
    dsas_loggedin();
    dsas_check_warnings();
    dsas_display_web("all");
    break;
case "DSAS Login":
    dsas_init_loggedin();
    break;
case "Password":
    dsas_loggedin(true, false);
    dsas_display_passwd();
    break;
case "Users":
    dsas_loggedin();
    dsas_loggedin(true, false);
    dsas_display_users();
    break;
default:
    // Assume on "index.html"
    dsas_loggedin();
    dsas_check_warnings();
    dsas_display_status();
    break;
}
