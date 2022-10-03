// DSAS entry point
import "../scss/styles.scss";
// eslint-disable-next-line no-unused-vars
import * as bootstrap from "bootstrap";
import "./DsasHeader";
import { dsasLoggedin, dsasCheckWarnings } from "./DsasUtil";
import dsasInitLoggedin from "./DsasLogin"; // For the "login.html" page
import dsasDisplayStatus from "./DsasStatus"; // For the "index.html" page
import dsasDisplayPasswd from "./DsasPasswd"; // For the "passwd.html" page
import dsasDisplayUsers from "./DsasUsers"; // For the "users.html" page
import dsasDisplayHelp from "./DsasHelp"; // For the "help.html" page
import dsasDisplayCert from "./DsasCert"; // For the "cert.html" page
import dsasDisplayNet from "./DsasNet"; // For the "net.html" page
import dsasDisplayService from "./DsasService"; // For the "service.html" page
import dsasDisplayTasks from "./DsasTask"; // For the "tasks.html" page
import dsasDisplayWeb from "./DsasWeb"; // For the "web.html" page

// Main initialisation code
switch (document.title) {
case "Help":
    dsasLoggedin();
    dsasCheckWarnings();
    dsasDisplayHelp();
    break;
case "Certificates":
    dsasLoggedin();
    dsasCheckWarnings();
    dsasDisplayCert();
    break;
case "Net":
    dsasLoggedin();
    dsasCheckWarnings();
    dsasDisplayNet();
    break;
case "Service":
    dsasLoggedin();
    dsasCheckWarnings();
    dsasDisplayService();
    break;
case "Tasks":
    dsasLoggedin();
    dsasCheckWarnings();
    dsasDisplayTasks();
    break;
case "Web":
    dsasLoggedin();
    dsasCheckWarnings();
    dsasDisplayWeb();
    break;
case "DSAS Login":
    dsasInitLoggedin();
    break;
case "Password":
    dsasLoggedin(true, false);
    dsasDisplayPasswd();
    break;
case "Users":
    dsasLoggedin();
    dsasCheckWarnings();
    dsasDisplayUsers();
    break;
default:
    // Assume on "index.html"
    dsasLoggedin();
    dsasCheckWarnings();
    dsasDisplayStatus();
    break;
}
