//    DSAS - Tinycore
//    Copyright (C) 2021-2022  Electricite de France
//
//    This program is free software; you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation; either version 2 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License along
//    with this program; if not, write to the Free Software Foundation, Inc.,
//    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

// The javascript used by the DSAS index.html page
import DisplayLogs from "./DisplayLogs";
import { _ } from "./MultiLang";
import { modalMessage } from "./DsasModal";
import {
    failLoggedin,
    dsasOrigin,
    dateToLocale,
    dsasClearTimeout,
    dsasSetTimeout,
} from "./DsasUtil";

// Global variable for the DisplayLogs instance for status logs
let statusLogs;

function formatSpace(bytes) {
    // Special case zero
    if (bytes === 0) { return "0 " + _("B"); }
    const symbols = ["B", "kB", "MB", "GB", "TB", "PB"];
    const exp = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / 1024 ** Math.floor(exp)).toFixed(2) + " " + _(symbols[exp]);
}

function machineStatus(name, obj) {
    let p = 100.0 - (100.0 * obj.disk_free) / obj.disk_total;
    document.getElementById(name + "Disk").textContent = _("Disk : {0}", obj.disk);
    document.getElementById(name + "DiskSize").textContent = formatSpace(obj.disk_total
        - obj.disk_free) + " / " + formatSpace(obj.disk_total);
    document.getElementById(name + "DiskBar").setAttribute("style", "width: " + p.toFixed() + "%");
    document.getElementById(name + "DiskBar").setAttribute("aria-valuenow", p.toFixed());
    document.getElementById(name + "DiskBar").textContent = p.toFixed(1) + "%";
    if (p > 90.0) {
        document.getElementById(name + "DiskBar").className = "progress-bar bg-danger";
    } else {
        document.getElementById(name + "DiskBar").className = "progress-bar";
    }
    p = (100.0 * obj.memory_used) / obj.memory_total;
    document.getElementById(name + "Memory").textContent = formatSpace(obj.memory_used)
        + " / " + formatSpace(obj.memory_total);
    document.getElementById(name + "MemoryBar").setAttribute("style", "width: " + p.toFixed() + "%");
    document.getElementById(name + "MemoryBar").setAttribute("aria-valuenow", p.toFixed());
    document.getElementById(name + "MemoryBar").textContent = p.toFixed(1) + "%";
    if (p > 90.0) {
        document.getElementById(name + "MemoryBar").className = "progress-bar bg-danger";
    } else {
        document.getElementById(name + "MemoryBar").className = "progress-bar";
    }
    if (obj.loadavg < 0.01) {
        p = 0;
    } else {
    // Scale by the number of cores
        p = ((Math.log10(obj.loadavg / obj.cores) + 2) * 25);
        p = (p > 100 ? 100 : p);
    }
    document.getElementById(name + "LoadAvg").textContent = obj.loadavg;
    document.getElementById(name + "LoadBar").setAttribute("style", "width: " + p.toFixed() + "%");
    document.getElementById(name + "LoadBar").setAttribute("aria-valuenow", p.toFixed());
    document.getElementById(name + "LoadBar").textContent = obj.loadavg;
    if (p > 60.0) {
        document.getElementById(name + "LoadBar").className = "progress-bar bg-danger";
    } else {
        document.getElementById(name + "LoadBar").className = "progress-bar";
    }
}

function dsasRefreshLogs(all = false) {
    // Only get the lines that have changed in the most recent log"
    const uri = new URL("api/dsas-verif-logs.php", dsasOrigin());
    uri.search = new URLSearchParams({ REFRESH_LEN: statusLogs.logs[0].length });

    fetch(uri).then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((logs) => {
        if (logs) { statusLogs.appendlog(logs); }

        // Automatically refresh the logs every 5 seconds
        dsasSetTimeout("logs", dsasRefreshLogs, 5000, all);
    }).catch((error) => {
        if (failLoggedin(error)) {
            dsasClearTimeout("logs");
            dsasClearTimeout("status");
        } else {
            modalMessage(_("Error ({0}) during the download of the logs : {1}", 0, (error.message ? error.message : error)));
        }
    });
}

function dsasStatus() {
    fetch("api/dsas-status.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((obj) => {
        machineStatus("Lower", obj.bas);
        if (obj.haut.status === "down") {
            document.getElementById("UpperName").className = "text-danger";
            document.getElementById("UpperName").textContent = _("Upper Machine :") + " " + _("UNAVAILABLE");
            document.getElementById("Upper").className = "col-6 container p-3 border text-muted";
        } else {
            document.getElementById("UpperName").className = "";
            document.getElementById("UpperName").textContent = _("Upper Machine :");
            document.getElementById("Upper").className = "col-6 container p-3 border";
        }
        machineStatus("Upper", obj.haut);
        // Automatically refresh the page
        dsasSetTimeout("status", dsasStatus, 5000);
    }).catch((error) => {
        if (failLoggedin(error)) {
            dsasClearTimeout("logs");
            dsasClearTimeout("status");
        } else {
            modalMessage(_("Error ({0}) during the machine detection : {1}", 0, (error.message ? error.message : error)));
        }
    });
}

function logFilter(line) {
    return (line.substr(0, 2) !== "  ");
}

function logHighlight(line) {
    return (line.substr(0, 2) === "  " ? 0 : 7);
}

function logRender(line) {
    try {
        const res = _(line.substr(4, 15).trim()).padEnd(15);
        const sa = line.substr(20).split(/(\s+)/);
        const hash = sa[0];
        const date = dateToLocale(sa[2]).padEnd(25);
        const path = line.substr(19 + sa[0].length + sa[1].length + sa[2].length + sa[3].length);
        return res + " " + hash + " " + date + " " + path;
    } catch (e) {
        return line;
    }
}

function dsasToggleLogs() {
    const btn = document.getElementById("loghide");
    if (btn.value === _("All logs")) {
        btn.value = _("Errors only");
        statusLogs.updatefilter(logFilter);
        dsasSetTimeout("logs", dsasRefreshLogs, 5000, false);
    } else {
        btn.value = _("All logs");
        statusLogs.updatefilter("");
        dsasSetTimeout("logs", dsasRefreshLogs, 5000, true);
    }
}

function dsasDisplayLogs() {
    fetch("api/dsas-verif-logs.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((logs) => {
        document.getElementById("loghide").addEventListener("click", dsasToggleLogs);
        document.getElementById("logsearch").addEventListener("keypress", (event) => {
            if (event.key === "Enter") statusLogs.search(document.getElementById("logsearch").value);
        });

        if (logs) {
            statusLogs = new DisplayLogs("logwind", logs, false, logHighlight, "", logRender);

            // Automatically refresh the logs every 5 seconds
            dsasSetTimeout("logs", dsasRefreshLogs, 5000);
        } else { modalMessage(_("No logs returned by the DSAS")); }
    }).catch((error) => {
        if (failLoggedin(error)) {
            dsasClearTimeout("logs");
            dsasClearTimeout("status");
        } else {
            modalMessage(_("Error ({0}) during the download of the logs : {1}", 0, (error.message ? error.message : error)));
        }
    });
}

export default function dsasDisplayStatus() {
    dsasStatus();
    dsasDisplayLogs();
}
