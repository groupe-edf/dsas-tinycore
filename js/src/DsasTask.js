// The javascript used by the DSAS task.html page
import DisplayLogs from "./DisplayLogs";
import { _ } from "./MultiLang";
import { modal_message, modal_errors, modal_action } from "./DsasModal";
import {
    fail_loggedin,
    clear_feedback,
    print_obj,
    empty_obj,
    date_to_locale,
    cert_name,
    cert_is_ca,
} from "./DsasUtil";

// Global variable for the DisplayLog instance for the task log files
let infoLogs;

// Global variable for the log refresh and task info tasks
let timeoutInfo;
let timeoutTasks;

function clearTimeouts() {
    if (timeoutInfo !== 0) { clearTimeout(timeoutInfo); }
    if (timeoutTasks !== 0) { clearTimeout(timeoutTasks); }
}

function task_body(task) {
    let body = "";

    body = "<div class=\"container\">"
        + "<div class=\"row\">"
        + "<div class=\"col-6 overflow-hidden\">"
        + "<p class=\"my-0\">" + _("Directory :") + " " + print_obj(task.directory) + "</p>"
        + "<p class=\"my-0\">" + _("URI :") + " " + print_obj(task.uri) + "</p>"
        + "<p class=\"my-0\">" + _("URI Certification Authority :") + " "
        + (empty_obj(task.ca.name) ? _("Base") : print_obj(task.ca.name)) + "</p>"
        + "<p class=\"my-0\">" + _("Task type :") + " " + print_obj(task.type) + "</p>"
        + "<p class=\"my-0\">" + _("Periodicity :") + " " + print_obj(task.run) + "</p>"
        + "<p class=\"my-0\">" + _("Last :") + " " + date_to_locale(task.last) + "</p>"
        + "<p class=\"my-0\">" + _("Status :") + " " + print_obj(task.status) + "</p>"
        + "</div>"
        + "<div class=\"col-6  overflow-hidden\">"
        + "<p class=\"my-1\">" + _("Certificates :") + "</p>"
        + "<div class=\"container p-1 my-1 border overflow-hidden\">";

    if (empty_obj(task.cert)) {
        body += "<p class=\"my-0\"></p>";
    } else if (task.cert.constructor === Object) {
        body += "<p class=\"my-0\">" + task.cert.name + "</p>";
    } else {
        task.cert.forEach((cert) => {
            body += "<p class=\"my-0\">" + cert.name + "</p>";
        });
    }
    body += "</div></div></div></div>";

    return body;
}

export default function dsas_display_tasks(what = "all") {
    if (what === "all" || what === "tasks" || what === "status") {
        fetch("api/dsas-task.php").then((response) => {
            if (response.ok) { return response.json(); }
            return Promise.reject(new Error(response.statusText));
        }).then((tasks) => {
            let i = 0;
            let body = "";
            clearTimeout(timeoutTasks);
            if (tasks.task) {
                (tasks.task.constructor === Object ? [tasks.task] : tasks.task).forEach((task) => {
                    const tid = document.getElementById("task" + i);
                    let cls = "text-success";
                    if (task.status === "Running") { cls = "text-primary"; }
                    if (task.last === "never") { cls = "text-info"; }
                    if (task.status === "Failed") { cls = "text-danger"; }
                    body += "<p class=\"my-0 " + cls + "\"><a class=\"text-toggle\" data-bs-toggle=\"collapse\" href=\"#task" + i + "\" role=\"button\""
                        + "aria-controls=\"task" + i + "\" aria-expanded=\"" + (tid && what === "status" && tid.className.includes("show") ? "true" : "false") + "\">"
                        + "<i class=\"text-collapsed\"><img src=\"caret-right.svg\"/></i>"
                        + "<i class=\"text-expanded\"><img src=\"caret-down.svg\"/></i></a><span id=\"taskname" + i + "\">" + task.name + "</span>"
                        + "&nbsp;<a data-toggle=\"tooltip\" title=\"" + _("Edit") + "\" onclick=\"dsas_task_modify('" + task.id + "', '" + task.name + "');\">"
                        + "<img src=\"pencil-square.svg\"></a>";
                    body += "&nbsp;<a data-toggle=\"tooltip\" title=\"" + _("Delete") + "\" onclick=\"dsas_task_delete('" + task.id
                        + "', '" + task.name + "');\"><img src=\"x-lg.svg\"></a>";
                    body += "&nbsp;<a data-toogle=\"tooltip\" title=\"" + _("Run") + "\" onclick=\"dsas_task_run('" + task.id
                        + "', '" + task.name + "');\"><img src=\"play.svg\"></a>";
                    body += "&nbsp;<a data-toogle=\"tooltip\" title=\"" + _("Info") + "\" onclick=\"dsas_task_info('" + task.id
                        + "', '" + task.name + "');\"><img src=\"info.svg\"></a>";
                    if (task.status === "Running") {
                        body += "&nbsp;<a data-toogle=\"tooltip\" title=\"" + _("Kill process") + "\" onclick=\"dsas_task_kill('" + task.id
                            + "', '" + task.name + "');\"><img src=\"kill.svg\"></a>";
                    }
                    // Keep the tab open if only updating the status
                    body += "</p><div class=\"" + (tid && what === "status" ? tid.className : "collapse") + "\" id=\"task" + i + "\"><div class=\"card card-body\">"
                        + "<pre>" + task_body(task) + "</pre></div></div>\n";
                    i += 1;
                });
            }
            document.getElementById("Tasks").innerHTML = body;
            timeoutTasks = setTimeout(dsas_display_tasks, 10000, "status");
        }).catch((error) => {
            if (fail_loggedin(error)) { clearTimeouts(); }
        });
    }
}

function dsas_task_real_delete(id) {
    const formData = new FormData();
    const deleteFiles = document.getElementById("TaskDeleteFiles").checked;
    formData.append("op", "delete");
    formData.append("id", id);
    formData.append("delete", deleteFiles);
    fetch("api/dsas-task.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modal_errors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clear_feedback();
            dsas_display_tasks("tasks");
        }
    }).catch((error) => {
        if (fail_loggedin(error)) {
            clearTimeouts();
        } else {
            modal_message(_("Error : {0}", (error.message ? error.message : error)));
        }
    });
}

export function dsas_task_delete(id, name) {
    const body = _("Delete the task ?<br><small>&nbsp;&nbsp;Name : {0}<br>&nbsp;&nbsp;ID : {1}</small>", name, id)
        + "<br><input class=\"form-check-iput\" type=\"checkbox\" id=\"TaskDeleteFiles\" checked>"
        + "<label class=\"form-check-label\" for=\"TaskDeleteFiles\">" + _("Delete task files") + "</label>";
    modal_action(body, () => { dsas_task_real_delete(id); }, true);
}
window.dsas_task_delete = dsas_task_delete;

function dsas_task_real_kill(id) {
    const formData = new FormData();
    formData.append("op", "kill");
    formData.append("id", id);
    fetch("api/dsas-task.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modal_errors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clear_feedback();
            dsas_display_tasks("status");
        }
    }).catch((error) => {
        if (fail_loggedin(error)) {
            clearTimeouts();
        } else {
            modal_message(_("Error : {0}", (error.message ? error.message : error)));
        }
    });
}

export function dsas_task_kill(id, name) {
    const body = _("Kill the task ?<br><small>&nbsp;&nbsp;Name : {0}<br>&nbsp;&nbsp;ID : {1}</small>", name, id);
    modal_action(body, () => { dsas_task_real_kill(id); }, true);
}
window.dsas_task_kill = dsas_task_kill;

function has_arch(archs, arch) {
    return (archs.constructor === Object ? [archs] : archs).includes(arch);
}

function task_arch_body(type, archs) {
    if (type !== "deb") {
        document.getElementById("TaskHasArch").setAttribute("hidden", "");
    } else {
        document.getElementById("TaskHasArch").removeAttribute("hidden");
        [["Source", "source"],
            ["All", "all"],
            ["Amd64", "amd64"],
            ["Arm64", "arm64"],
            ["ArmEL", "armel"],
            ["ArmHF", "armhf"],
            ["I386", "i386"],
            ["Mips64EL", "mips64el"],
            ["MipsEL", "mipsel"],
            ["Ppc64EL", "ppc64el"],
            ["S390x", "s390x"]].forEach((arch) => {
            if (has_arch(archs, arch[1])) {
                document.getElementById("TaskArch" + arch[0]).setAttribute("checked", "");
            } else {
                document.getElementById("TaskArch" + arch[0]).removeAttribute("checked");
            }
        });
    }
}

function dsas_add_task_arch(archs = []) {
    let type = "";
    [...document.getElementsByTagName("option")].forEach((opt) => {
        if (opt.id.substr(0, 8) === "TaskType" && opt.selected) { type = opt.value; }
    });
    task_arch_body(type, archs);
}
window.dsas_add_task_arch = dsas_add_task_arch;

export function dsas_add_task(oldid = "") {
    const name = document.getElementById("TaskName").value;
    const directory = document.getElementById("TaskDirectory").value;
    const uri = document.getElementById("TaskURI").value;
    let type = "";
    let run = "";
    let ca = {};
    const certs = [];
    const archs = [];

    [...document.getElementsByTagName("option")].forEach((opt) => {
        if (opt.id.substr(0, 8) === "TaskType" && opt.selected) { type = opt.value; }
        if (opt.id.substr(0, 7) === "TaskRun" && opt.selected) { run = opt.value; }
        if (opt.id.substr(0, 6) === "TaskCA" && opt.selected) {
            if (opt.id === "TaskCA_Base") {
                ca = { fingerprint: opt.value, name: "Base" };
            } else if (opt.id === "TaskCA_Self") {
                ca = { fingerprint: opt.value, name: "Self-Signed" };
            } else {
                ca = { fingerprint: opt.value, name: opt.innerHTML };
            }
        }
    });
    if (type === "deb") {
        [...document.getElementsByTagName("input")].forEach((inp) => {
            if (inp.id.substr(0, 8) === "TaskArch") {
                archs.push({ arch: inp.value, active: (inp.checked ? "true" : "false") });
            }
        });
    }
    [...document.getElementsByTagName("dsas-task-cert")].forEach((cert) => certs.push({ name: cert.getAttribute("name"), fingerprint: cert.getAttribute("fingerprint") }));

    const formData = new FormData();
    formData.append("op", "add");
    formData.append("data", JSON.stringify({
        name,
        id: oldid,
        directory,
        uri,
        type,
        run,
        ca,
        certs,
        archs,
    }));
    fetch("api/dsas-task.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modal_errors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clear_feedback();
            dsas_display_tasks("status");
        }
    }).catch((error) => {
        if (fail_loggedin(error)) {
            clearTimeouts();
        } else {
            modal_message(_("Error : {0}", (error.message ? error.message : error)));
        }
    });
}
window.dsas_add_task = dsas_add_task;

export function dsas_add_task_cert() {
    const taskCert = document.getElementById("TaskCert");
    const opt = [...document.getElementsByTagName("option")]
        .filter((o) => o.id.substr(0, 7) !== "TaskRun"
            && o.id.substr(0, 8) !== "TaskType"
            && o.id.substr(0, 6) !== "TaskCA"
            && o.selected);
    if (opt) {
        const name = opt[0].innerHTML;
        const finger = opt[0].value;
        let add = true;
        [...document.getElementsByTagName("dsas-task-cert")]
            .filter((line) => line.getAttribute("fingerprint") === finger).forEach(() => { add = false; });
        if (add) {
            taskCert.innerHTML = taskCert.innerHTML + "<dsas-task-cert name=\"" + name
          + "\" fingerprint=\"" + finger + "\"></dsas-task-cert>";
        }
    }
}
window.dsas_add_task_cert = dsas_add_task_cert;

function modal_info(name, text) {
    const modalDSAS = document.getElementById("modalDSAS");
    modalDSAS.removeAttribute("disable");
    modalDSAS.setAttribute("static", false);
    modalDSAS.setAttribute("hideonclick", true);
    modalDSAS.setAction("clearTimeout(timeoutInfo)");
    modalDSAS.setAttribute("title", _("Info : {0}", name));
    modalDSAS.setAttribute("type", "Ok");
    modalDSAS.setAttribute("size", "xl");
    modalDSAS.setBody(text);
    modalDSAS.show();
}

function modal_task(action = () => { dsas_add_task(); }, ca = "", taskchange = () => { dsas_add_task_arch(); }) {
    const modalDSAS = document.getElementById("modalDSAS");
    const temp = document.getElementById("newtasktemplate");
    const b = temp.content.cloneNode(true);
    modalDSAS.removeAttribute("disable");
    modalDSAS.removeAttribute("type");
    modalDSAS.removeAttribute("static");
    if (action) {
        modalDSAS.setAction(action);
    } else {
        modalDSAS.setAction();
    }
    modalDSAS.setAttribute("hideonclick", true);
    modalDSAS.setAttribute("title", _("Add a task"));
    modalDSAS.setAttribute("size", "lg");
    b.getElementById("TaskType").addEventListener("change", taskchange);
    b.getElementById("TaskAddCert").addEventListener("change", () => { dsas_add_task_cert(); });
    modalDSAS.show();
    modalDSAS.setBody(b);

    fetch("api/dsas-cert.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((certs) => {
        let i = 1;
        const body = document.getElementById("bodyDSAS");
        const certopt = body.querySelector("#TaskAddCert");
        const certca = body.querySelector("#TaskCA");
        let opt = certopt.appendChild(document.createElement("option"));
        opt.id = "TaskAddCert0";
        opt.setAttribute("selected", "");
        opt.textContent = _("Select a certificate");
        certs[0].dsas.x509.forEach((cert) => {
            opt = certopt.appendChild(document.createElement("option"));
            opt.id = "TaskAddCert" + i;
            opt.value = cert.fingerprint;
            opt.textContent = cert_name(cert);
            i += 1;
        });
        certs[0].dsas.pubkey.forEach((cert) => {
            opt = certopt.appendChild(document.createElement("option"));
            opt.id = "TaskAddCert" + i;
            opt.value = cert.fingerprint;
            opt.textContent = cert.name;
            i += 1;
        });
        certs[0].dsas.gpg.forEach((cert) => {
            opt = certopt.appendChild(document.createElement("option"));
            opt.id = "TaskAddCert" + i;
            opt.value = cert.fingerprint;
            opt.textContent = cert.uid;
            i += 1;
        });
        certs[0].ca.forEach((cert) => {
            opt = certopt.appendChild(document.createElement("option"));
            opt.id = "TaskAddCert" + i;
            opt.value = cert.fingerprint;
            opt.textContent = cert_name(cert);
            i += 1;
        });
        opt = certca.appendChild(document.createElement("option"));
        opt.id = "TaskCA_Base";
        if (empty_obj(ca)) { opt.setAttribute("selected", ""); }
        opt.textContent = _("Base CA");
        opt = certca.appendChild(document.createElement("option"));
        opt.id = "TaskCA_Self";
        opt.value = "self";
        if (ca === "self") { opt.setAttribute("selected", ""); }
        opt.textContent = _("Self-signed");
        certs[0].dsas.x509.forEach((cert) => {
            if (cert_is_ca(cert)) {
                opt = certca.appendChild(document.createElement("option"));
                opt.id = "TaskCACert_" + cert.fingerprint;
                opt.value = cert.fingerprint;
                if (ca === cert.fingerprint) { opt.setAttribute("selected", ""); }
                opt.textContent = cert_name(cert);
            }
        });
    }).catch((error) => {
        if (fail_loggedin(error)) {
            clearTimeouts();
        } else {
            modal_message(_("Error while loading the certificates : {0}", (error.message ? error.message : error)));
        }
    });
}

export function dsas_task_new() {
    modal_task();
    document.getElementById("TaskName").value = "";
    document.getElementById("TaskDirectory").value = "";
    document.getElementById("TaskURI").value = "";
    [...document.getElementsByTagName("option")].forEach((opt) => {
        // eslint-disable-next-line no-param-reassign
        opt.selected = (opt.id === "TaskTypeNull"
            || opt.id === "TaskRunNull"
            || opt.id === "TaskAddCert0"
            || opt.id === "TaskCA_Base");
    });
    document.getElementById("TaskCert").textContent = "";
}
window.dsas_task_new = dsas_task_new;

// The argument name to this function is not used but added to be consistent
// with the other dsas_task_* functions to make other code easier to use
// eslint-disable-next-line no-unused-vars
export function dsas_task_modify(id, name) {
    fetch("api/dsas-task.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((tasks) => {
        if (tasks.task) {
            (tasks.task.constructor === Object ? [tasks.task] : tasks.task)
                .filter((task) => id === task.id).forEach((task) => {
                    modal_task(() => { dsas_modify_task(task.name, task.id); }, task.ca.fingerprint, () => { dsas_add_task_arch(task.archs);  });
                    document.getElementById("TaskName").value = print_obj(task.name);
                    document.getElementById("TaskDirectory").value = print_obj(task.directory);
                    document.getElementById("TaskURI").value = print_obj(task.uri);

                    [...document.getElementsByTagName("option")].forEach((opt) => {
                        // eslint-disable-next-line no-param-reassign
                        opt.selected = (((opt.id.substr(0, 8) === "TaskType") && (opt.value === task.type))
                                || ((opt.id.substr(0, 7) === "TaskRun") && (opt.value === task.run))
                                || ((opt.id.substr(0, 11) === "TaskAddCert") && (opt.id === "TaskAddCert0")));
                    });
                    const taskcerts = document.getElementById("TaskCert");
                    taskcerts.textContent = "";
                    if (task.cert.constructor === Object) {
                        const el = taskcerts.appendChild(document.createElement("dsas-task-cert"));
                        el.name = task.cert.name;
                        el.fingerprint = task.cert.fingerprint;
                    } else {
                        task.cert.forEach((cert) => {
                            const el = taskcerts.appendChild(document.createElement("dsas-task-cert"));
                            el.name = cert.name;
                            el.fingerprint = cert.fingerprint;
                        });
                    }
                    task_arch_body(task.type, task.archs.arch);
                });
        }
    }).catch((error) => {
        if (fail_loggedin(error)) { clearTimeouts(); }
    });
}
window.dsas_task_modify = dsas_task_modify;

function dsas_task_real_run(id) {
    const formData = new FormData();
    formData.append("op", "run");
    formData.append("id", id);
    fetch("api/dsas-task.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modal_errors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clear_feedback();
            // Delay update of task status 0,5 seconds to allow runlog file to be updated first
            timeoutTasks = setTimeout(dsas_display_tasks, 500, "status");
        }
    }).catch((error) => {
        if (fail_loggedin(error)) {
            clearTimeouts();
        } else {
            modal_message(_("Error : {0}", (error.message ? error.message : error)));
        }
    });
}

export function dsas_task_run(id, name) {
    modal_action(
        _("Run the task ?&nbsp;&nbsp;Name : {0}<br>&nbsp;&nbsp;ID : {1}", name, id),
        () => { dsas_task_real_run(id); },
        true,
    );
}
window.dsas_task_run = dsas_task_run;

export function dsas_task_info(id, name, len = 0) {
    const formData = new FormData();
    formData.append("op", "info");
    formData.append("id", id);
    formData.append("len", len);
    fetch("api/dsas-task.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        const info = JSON.parse(text);
        if (info && (info[0].constructor === Object) && (Object.keys(info[0])[0] === "error")) {
            modal_errors(info);
            if (timeoutInfo !== 0) { clearTimeout(timeoutInfo); }
        } else {
            if (len === 0) {
                modal_info(name, "<span id=\"logwind\"></span>");
                infoLogs = new DisplayLogs("logwind", info);
            } else { infoLogs.appendlog(info); }

            // Automatically refresh the logs every 5 seconds
            if (timeoutInfo !== 0) { clearTimeout(timeoutInfo); }
            timeoutInfo = setTimeout(dsas_task_info, 5000, id, name, infoLogs.logs[0].length);
        }
    }).catch((error) => {
        if (fail_loggedin(error)) {
            clearTimeouts();
        } else {
            modal_message(_("Error : {0}", (error.message ? error.message : error)));
        }
    });
}
window.dsas_task_info = dsas_task_info;

function dsas_task_cert_delete(fingerprint) {
    const taskcerts = document.getElementById("TaskCert");
    [...document.getElementsByTagName("dsas-task-cert")]
        .filter((line) => line.getAttribute("fingerprint") === fingerprint)
        .forEach((line) => { line.remove(); });
}

export function dsas_modify_task(oldname = "", oldid = "") {
    const name = document.getElementById("TaskName").value;

    // If the old name is not empty and different than the new name, then we're
    // modifying a task and we've changed the name.
    if (oldname && oldname !== name) {
        const formData = new FormData();
        formData.append("op", "name");
        formData.append("data", JSON.stringify({
            old: oldname,
            new: name,
            id: oldid,
        }));
        fetch("api/dsas-task.php", { method: "POST", body: formData }).then((response) => {
            if (response.ok) { dsas_add_task(oldid); }
            return Promise.reject(new Error(response.statusText));
        }).catch((error) => {
            if (fail_loggedin(error)) {
                clearTimeouts();
            } else {
                modal_message(_("Error : {0}", (error.message ? error.message : error)));
            }
        });
    } else { dsas_add_task(oldid); }
}
window.dsas_modify_task = dsas_modify_task;

class DSASTaskCert extends HTMLElement {
    connectedCallback() {
        if (!this.rendered) {
            this.render();
            this.rendered = true;
        }
    }

    render() {
        const name = this.getAttribute("name");
        const fingerprint = this.getAttribute("fingerprint");
        this.textContent = "";
        let el = this.appendChild(document.createElement("p"));
        el.className = "my-0";
        el.textContent = name;
        el = el.appendChild(document.createElement("a"));
        el.setAttribute("data-toggle", "tooltip");
        el.title = _("Delete");
        el.addEventListener("click", () => { dsas_task_cert_delete(fingerprint); });
        el = el.appendChild(document.createElement("img"));
        el.src = "x-lg.svg";
    }

    static get observedAttributes() {
        return ["name", "fingerprint"];
    }

    attributeChangedCallback() {
        this.render();
    }
}

if (customElements.get("dsas-task-cert") === undefined) {
    customElements.define("dsas-task-cert", DSASTaskCert);
}
