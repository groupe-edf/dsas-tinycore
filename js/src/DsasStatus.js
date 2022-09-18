// The javascript used by the DSAS index.html page
import DisplayLogs from "./DisplayLogs";
import { _ } from "./MultiLang";
import { modal_message } from "./DsasModal";
import { fail_loggedin, dsas_origin, date_to_locale } from "./DsasUtil";

// Global variable for the DisplayLogs instance for status logs
let statusLogs;

// Global variables for the status and log refresh
let timeoutStatus;
let timeoutLogs;

function clearTimeouts() {
    if (timeoutStatus !== 0) { clearTimeout(timeoutStatus); }
    if (timeoutLogs !== 0) { clearTimeout(timeoutLogs); }
}

function format_space(bytes) {
    // Special case zero
    if (bytes === 0) { return "0 B"; }

    // FIXME : Should I translate the units here ?
    const symbols = ["B", "KB", "MB", "GB", "TB", "PB"];
    const exp = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / 1024 ** Math.floor(exp)).toFixed(2) + " " + symbols[exp];
}

function machine_status(name, obj) {
    let p = 100.0 - (100.0 * obj.disk_free) / obj.disk_total;
    document.getElementById(name + "Disk").textContent = _("Disk : {0}", obj.disk);
    document.getElementById(name + "DiskSize").textContent = format_space(obj.disk_total
        - obj.disk_free) + " / " + format_space(obj.disk_total);
    document.getElementById(name + "DiskBar").setAttribute("style", "width: " + p.toFixed() + "%");
    document.getElementById(name + "DiskBar").setAttribute("aria-valuenow", p.toFixed());
    document.getElementById(name + "DiskBar").textContent = p.toFixed(1) + "%";
    p = (100.0 * obj.memory_used) / obj.memory_total;
    document.getElementById(name + "Memory").textContent = format_space(obj.memory_used)
        + " / " + format_space(obj.memory_total);
    document.getElementById(name + "MemoryBar").setAttribute("style", "width: " + p.toFixed() + "%");
    document.getElementById(name + "MemoryBar").setAttribute("aria-valuenow", p.toFixed());
    document.getElementById(name + "MemoryBar").textContent = p.toFixed(1) + "%";
    if (obj.loadavg < 0.01) {
        p = 0;
    } else {
    // Scale by the number of cores
        p = ((Math.log10(obj.loadavg) + 2) * 25) / obj.cores;
        p = (p > 100 ? 100 : p);
    }
    document.getElementById(name + "LoadAvg").textContent = obj.loadavg;
    document.getElementById(name + "LoadBar").setAttribute("style", "width: " + p.toFixed() + "%");
    document.getElementById(name + "LoadBar").setAttribute("aria-valuenow", p.toFixed());
    document.getElementById(name + "LoadBar").textContent = obj.loadavg;
}

function dsas_refresh_logs(all = false) {
    // Only get the lines that have changed in the most recent log"
    const uri = new URL("api/dsas-verif-logs.php", dsas_origin());
    uri.search = new URLSearchParams({ REFRESH_LEN: statusLogs.logs[0].length });

    fetch(uri).then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((logs) => {
        if (logs) { statusLogs.appendlog(logs); }

        // Automatically refresh the logs every 5 seconds
        if (timeoutLogs !== 0) { clearTimeout(timeoutLogs); }
        timeoutLogs = setTimeout(dsas_refresh_logs, 5000, all);
    }).catch((error) => {
        if (fail_loggedin(error)) {
            clearTimeouts();
        } else {
            modal_message(_("Error ({0}) during the download of the logs : {1}", 0, (error.message ? error.message : error)));
        }
    });
}

function dsas_status() {
    fetch("api/dsas-status.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((obj) => {
        machine_status("Lower", obj.bas);
        if (obj.haut.status === "down") {
            document.getElementById("Upper").className = "col-6 container p-3 border text-muted";
        } else {
            document.getElementById("Upper").className = "col-6 container p-3 border";
        }
        machine_status("Upper", obj.haut);
        // Automatically refresh the page
        if (timeoutStatus !== 0) { clearTimeout(timeoutStatus); }
        timeoutStatus = setTimeout(dsas_status, 5000);
    }).catch((error) => {
        if (fail_loggedin(error)) {
            clearTimeouts();
        } else {
            modal_message(_("Error ({0}) during the machine detection : {1}", 0, (error.message ? error.message : error)));
        }
    });
}

function log_filter(line) {
    return (line.substr(0, 2) !== "  ");
}

function log_highlight(line) {
    return (line.substr(0, 2) === "  " ? 0 : 7);
}

function log_render(line) {
    try {
        const res = _(line.substr(4, 15).trim()).padEnd(15);
        const sa = line.substr(20).split(/(\s+)/);
        const hash = sa[0];
        const date = date_to_locale(sa[2]).padEnd(25);
        const path = line.substr(19 + sa[0].length + sa[1].length + sa[2].length + sa[3].length);
        return res + " " + hash + " " + date + " " + path;
    } catch (e) {
        return line;
    }
}

function dsas_togglelogs() {
    const btn = document.getElementById("loghide");
    if (timeoutLogs !== 0) { clearTimeout(timeoutLogs); }
    if (btn.value === _("All logs")) {
        btn.value = _("Errors only");
        statusLogs.updatefilter(log_filter);
        timeoutLogs = setTimeout(dsas_refresh_logs, 5000, false);
    } else {
        btn.value = _("All logs");
        statusLogs.updatefilter("");
        timeoutLogs = setTimeout(dsas_refresh_logs, 5000, true);
    }
}

function dsas_display_logs() {
    fetch("api/dsas-verif-logs.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((logs) => {
        document.getElementById("loghide").addEventListener("click", () => { dsas_togglelogs(); });
        document.getElementById("logsearch").addEventListener("keypress", (event) => {
            if (event.key === "Enter") statusLogs.search(document.getElementById("logsearch").value);
        });

        if (logs) {
            statusLogs = new DisplayLogs("logwind", logs, false, log_highlight, "", log_render);

            // Automatically refresh the logs every 5 seconds
            if (timeoutLogs !== 0) { clearTimeout(timeoutLogs); }
            timeoutLogs = setTimeout(dsas_refresh_logs, 5000);
        } else { modal_message(_("No logs returned by the DSAS")); }
    }).catch((error) => {
        if (fail_loggedin(error)) {
            clearTimeouts();
        } else {
            modal_message(_("Error ({0}) during the download of the logs : {1}", 0, (error.message ? error.message : error)));
        }
    });
}

export default function dsas_display_status() {
    dsas_status();
    dsas_display_logs("all");
}
