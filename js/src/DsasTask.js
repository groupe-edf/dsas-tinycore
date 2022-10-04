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

// The javascript used by the DSAS task.html page
import DisplayLogs from "./DisplayLogs";
import { ml, _ } from "./MultiLang";
import { modalMessage, modalErrors, modalAction } from "./DsasModal";
import {
    failLoggedin,
    clearFeedback,
    printObj,
    emptyObj,
    dateToLocale,
    certName,
    certIsCa,
    dsasSetTimeout,
    dsasClearTimeout,
} from "./DsasUtil";

// Global variable for the DisplayLog instance for the task log files
let infoLogs;

function dsasTaskRealDelete(id) {
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
            modalErrors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clearFeedback();
            // Circular referencing between these function is deliberate
            // eslint-disable-next-line no-use-before-define
            dsasDisplayTasks("tasks");
        }
    }).catch((error) => {
        if (failLoggedin(error)) {
            dsasClearTimeout("tasks");
            dsasClearTimeout("info");
        } else {
            modalMessage(_("Error : {0}", (error.message ? error.message : error)));
        }
    });
}

function dsasTaskDelete(id, name) {
    const modalDSAS = document.getElementById("modalDSAS");
    const body = document.createDocumentFragment();
    body.append(_(" Name : {0}\r\n ID : {1}", name, id) + "\r\n");
    let el = document.createElement("input");
    el.className = "form-check-input";
    el.id = "TaskDeleteFiles";
    el.setAttribute("type", "checkbox");
    el.setAttribute("checked", "");
    body.append(el);
    el = document.createElement("label");
    el.className = "form-check-label";
    el.setAttribute("for", "TaskDeleteFiles");
    el.textContent = " " + _("Delete task files");
    body.append(el);
    modalAction(_("Delete the task ?"), () => { dsasTaskRealDelete(id); }, true);
    modalDSAS.setBody(body);
}

function dsasTaskRealKill(id) {
    const formData = new FormData();
    formData.append("op", "kill");
    formData.append("id", id);
    fetch("api/dsas-task.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modalErrors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clearFeedback();
            // eslint-disable-next-line no-use-before-define
            dsasDisplayTasks("status");
        }
    }).catch((error) => {
        if (failLoggedin(error)) {
            dsasClearTimeout("tasks");
            dsasClearTimeout("info");
        } else {
            modalMessage(_("Error : {0}", (error.message ? error.message : error)));
        }
    });
}

function dsasTaskKill(id, name) {
    const modalDSAS = document.getElementById("modalDSAS");
    modalAction(_("Kill the task?"), () => { dsasTaskRealKill(id); }, true);
    modalDSAS.setBody(_(" Name : {0}\r\n ID : {1}", name, id));
}

function hasArch(archs, arch) {
    return (archs.constructor === Object ? [archs] : archs).includes(arch);
}

function taskArchBody(type, archs) {
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
            if (hasArch(archs, arch[1])) {
                document.getElementById("TaskArch" + arch[0]).setAttribute("checked", "");
            } else {
                document.getElementById("TaskArch" + arch[0]).removeAttribute("checked");
            }
        });
    }
}

function dsasAddTaskArch(archs = []) {
    let type = "";
    [...document.getElementsByTagName("option")].forEach((opt) => {
        if (opt.id.substr(0, 8) === "TaskType" && opt.selected) { type = opt.value; }
    });
    taskArchBody(type, archs);
}

function dsasAddTask(oldid = "") {
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
                ca = { fingerprint: "", name: "Base" };
            } else if (opt.id === "TaskCA_Self") {
                ca = { fingerprint: "self", name: "Self-Signed" };
            } else {
                ca = { fingerprint: opt.value, name: opt.textContent };
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
            modalErrors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clearFeedback();
            // eslint-disable-next-line no-use-before-define
            dsasDisplayTasks("status");
        }
    }).catch((error) => {
        if (failLoggedin(error)) {
            dsasClearTimeout("tasks");
            dsasClearTimeout("info");
        } else {
            modalMessage(_("Error : {0}", (error.message ? error.message : error)));
        }
    });
}

function dsasAddTaskCert() {
    const taskCert = document.getElementById("TaskCert");
    const opt = [...document.getElementsByTagName("option")]
        .filter((o) => o.id.substr(0, 7) !== "TaskRun"
            && o.id.substr(0, 8) !== "TaskType"
            && o.id.substr(0, 6) !== "TaskCA"
            && o.selected);
    if (opt) {
        const name = opt[0].textContent;
        const finger = opt[0].value;
        let add = true;
        [...document.getElementsByTagName("dsas-task-cert")]
            .filter((line) => line.getAttribute("fingerprint") === finger).forEach(() => { add = false; });
        if (add) {
            const el = taskCert.appendChild(document.createElement("dsas-task-cert"));
            el.setAttribute("name", name);
            el.setAttribute("fingerprint", finger);
        }
    }
}

function modalTask(action = dsasAddTask, ca = "", taskchange = dsasAddTaskArch) {
    const modalDSAS = document.getElementById("modalDSAS");
    const temp = document.getElementById("newtasktemplate");
    const b = temp.content.cloneNode(true);
    ml.translateHTML(b); // Need to force translation of templates after cloning
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
    b.getElementById("TaskAddCert").addEventListener("change", dsasAddTaskCert);
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
            opt.textContent = certName(cert);
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
            opt.textContent = certName(cert);
            i += 1;
        });
        opt = certca.appendChild(document.createElement("option"));
        opt.id = "TaskCA_Base";
        if (emptyObj(ca)) { opt.setAttribute("selected", ""); }
        opt.textContent = _("Base CA");
        opt = certca.appendChild(document.createElement("option"));
        opt.id = "TaskCA_Self";
        opt.value = "self";
        if (ca === "self") { opt.setAttribute("selected", ""); }
        opt.textContent = _("Self-signed");
        certs[0].dsas.x509.forEach((cert) => {
            if (certIsCa(cert)) {
                opt = certca.appendChild(document.createElement("option"));
                opt.id = "TaskCACert_" + cert.fingerprint;
                opt.value = cert.fingerprint;
                if (ca === cert.fingerprint) { opt.setAttribute("selected", ""); }
                opt.textContent = certName(cert);
            }
        });
    }).catch((error) => {
        if (failLoggedin(error)) {
            dsasClearTimeout("tasks");
            dsasClearTimeout("info");
        } else {
            modalMessage(_("Error while loading the certificates : {0}", (error.message ? error.message : error)));
        }
    });
}

function dsasModifyTask(oldname = "", oldid = "") {
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
            if (response.ok) { dsasAddTask(oldid); }
            return Promise.reject(new Error(response.statusText));
        }).catch((error) => {
            if (failLoggedin(error)) {
                dsasClearTimeout("tasks");
                dsasClearTimeout("info");
            } else {
                modalMessage(_("Error : {0}", (error.message ? error.message : error)));
            }
        });
    } else { dsasAddTask(oldid); }
}

// The argument name to this function is not used but added to be consistent
// with the other dsas_task_* functions to make other code easier to use
// eslint-disable-next-line no-unused-vars
function dsasTaskModify(id, name) {
    fetch("api/dsas-task.php").then((response) => {
        if (response.ok) { return response.json(); }
        return Promise.reject(new Error(response.statusText));
    }).then((tasks) => {
        if (tasks.task) {
            (tasks.task.constructor === Object ? [tasks.task] : tasks.task)
                .filter((task) => id === task.id).forEach((task) => {
                    modalTask(
                        () => { dsasModifyTask(task.name, task.id); },
                        task.ca.fingerprint,
                        () => { dsasAddTaskArch(task.archs); },
                    );
                    document.getElementById("TaskName").value = printObj(task.name);
                    document.getElementById("TaskDirectory").value = printObj(task.directory);
                    document.getElementById("TaskURI").value = printObj(task.uri);

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
                        el.setAttribute("name", task.cert.name);
                        el.setAttribute("fingerprint", task.cert.fingerprint);
                    } else {
                        task.cert.forEach((cert) => {
                            const el = taskcerts.appendChild(document.createElement("dsas-task-cert"));
                            el.setAttribute("name", cert.name);
                            el.setAttribute("fingerprint", cert.fingerprint);
                        });
                    }
                    taskArchBody(task.type, task.archs.arch);
                });
        }
    }).catch((error) => {
        if (failLoggedin(error)) {
            dsasClearTimeout("tasks");
            dsasClearTimeout("info");
        }
    });
}

function dsasTaskRealRun(id) {
    const formData = new FormData();
    formData.append("op", "run");
    formData.append("id", id);
    fetch("api/dsas-task.php", { method: "POST", body: formData }).then((response) => {
        if (response.ok) { return response.text(); }
        return Promise.reject(new Error(response.statusText));
    }).then((text) => {
        try {
            const errors = JSON.parse(text);
            modalErrors(errors);
        } catch (e) {
        // Its text => here always just "Ok"
            clearFeedback();
            // Delay update of task status 0,5 seconds to allow runlog file to be updated first
            // eslint-disable-next-line no-use-before-define
            dsasSetTimeout("tasks", dsasDisplayTasks, 500, "status");
        }
    }).catch((error) => {
        if (failLoggedin(error)) {
            dsasClearTimeout("tasks");
            dsasClearTimeout("info");
        } else {
            modalMessage(_("Error : {0}", (error.message ? error.message : error)));
        }
    });
}

function dsasTaskRun(id, name) {
    const modalDSAS = document.getElementById("modalDSAS");
    modalAction(_("Run the task ?"), () => { dsasTaskRealRun(id); }, true);
    modalDSAS.setBody(_(" Name : {0}\r\n ID : {1}", name, id));
}

function modalInfo(name, body) {
    const modalDSAS = document.getElementById("modalDSAS");
    modalDSAS.removeAttribute("disable");
    modalDSAS.setAttribute("static", false);
    modalDSAS.setAttribute("hideonclick", true);
    modalDSAS.setAction(() => { clearTimeout("info"); });
    modalDSAS.setAttribute("title", _("Info : {0}", name));
    modalDSAS.setAttribute("type", "Ok");
    modalDSAS.setAttribute("size", "xl");
    modalDSAS.setBody(body);
    modalDSAS.show();
}

function dsasTaskInfo(id, name, len = 0) {
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
            modalErrors(info);
            dsasClearTimeout("info");
        } else {
            if (len === 0) {
                const el = document.createElement("span");
                el.id = "logwind";
                modalInfo(name, el);
                infoLogs = new DisplayLogs("logwind", info);
            } else { infoLogs.appendlog(info); }

            // Automatically refresh the logs every 5 seconds
            dsasSetTimeout("info", dsasTaskInfo, 5000, id, name, infoLogs.logs[0].length);
        }
    }).catch((error) => {
        if (failLoggedin(error)) {
            dsasClearTimeout("tasks");
            dsasClearTimeout("info");
        } else {
            modalMessage(_("Error : {0}", (error.message ? error.message : error)));
        }
    });
}

function dsasTaskNew() {
    modalTask();
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

export default function dsasDisplayTasks(what = "all") {
    if (what === "all" || what === "tasks" || what === "status") {
        fetch("api/dsas-task.php").then((response) => {
            if (response.ok) { return response.json(); }
            return Promise.reject(new Error(response.statusText));
        }).then((tasks) => {
            let i = 0;
            dsasClearTimeout("tasks");
            const temp = document.getElementById("tasktemplate");
            const tasksrendered = document.createDocumentFragment();
            if (tasks.task) {
                (tasks.task.constructor === Object ? [tasks.task] : tasks.task).forEach((task) => {
                    const item = temp.content.cloneNode(true);
                    const links = item.querySelectorAll("a");
                    const card = item.getElementById("taskcard");
                    const certs = item.getElementById("taskcerts");
                    const tid = document.getElementById("task" + i);
                    ml.translateHTML(item);
                    let cls = "text-success";
                    if (task.last === "never") { cls = "text-info"; }
                    if (task.status === "Failed") { cls = "text-danger"; }
                    if (task.status === "Running") { cls = "text-primary"; }
                    item.querySelector("p").className = "my-0 " + cls;
                    links[0].href = "#task" + i;
                    links[0].setAttribute("aria-controls", "task" + i);
                    if (tid && what === "status" && tid.className.includes("show")) {
                        links[0].setAttribute("aria-expanded", "true");
                    }
                    item.querySelector("span").id = "taskname" + i;
                    item.querySelector("span").textContent = task.name;
                    // Need to use an immediately evaluated function (IIFE)
                    // to ensure 'task' is evaluated here
                    links[1].addEventListener("click", ((t) => (() => dsasTaskModify(t.id, t.name)))(task));
                    links[2].addEventListener("click", ((t) => (() => dsasTaskDelete(t.id, t.name)))(task));
                    links[3].addEventListener("click", ((t) => (() => dsasTaskRun(t.id, t.name)))(task));
                    links[4].addEventListener("click", ((t) => (() => dsasTaskInfo(t.id, t.name)))(task));
                    if (task.status === "Running") {
                        links[5].removeAttribute("hidden");
                        links[5].addEventListener("click", ((t) => (() => dsasTaskKill(t.id, t.name)))(task));
                    }
                    if (tid && what === "status") {
                        item.querySelector("div").className = tid.className;
                    }
                    item.querySelector("div").id = "task" + i;
                    [["Directory :", printObj(task.directory)],
                        ["URI : ", printObj(task.uri)],
                        ["URI Certification Authority :", (emptyObj(task.ca.name) ? _("Base") : printObj(task.ca.name))],
                        ["Task type :", printObj(task.type)],
                        ["Periodicity :", printObj(task.run)],
                        ["Last :", dateToLocale(task.last)],
                        ["Status :", printObj(task.status)],
                        ["Task type :", printObj(task.type)]].forEach((tt) => {
                        const line = card.appendChild(document.createElement("p"));
                        line.className = "my-0";
                        line.textContent = _(tt[0]) + " " + tt[1];
                    });

                    if (emptyObj(task.cert)) {
                        const line = certs.appendChild(document.createElement("p"));
                        line.className = "my-0";
                    } else if (task.cert.constructor === Object) {
                        const line = certs.appendChild(document.createElement("p"));
                        line.className = "my-0";
                        line.textContent = task.cert.name;
                    } else {
                        task.cert.forEach((cert) => {
                            const line = certs.appendChild(document.createElement("p"));
                            line.className = "my-0";
                            line.textContent = cert.name;
                        });
                    }
                    i += 1;
                    tasksrendered.appendChild(item);
                });
            }
            document.getElementById("Tasks").textContent = "";
            document.getElementById("Tasks").appendChild(tasksrendered);
            if (what === "all") {
                document.getElementById("AddTask").addEventListener("click", dsasTaskNew);
            }
            dsasSetTimeout("tasks", dsasDisplayTasks, 10000, "status");
        }).catch((error) => {
            if (failLoggedin(error)) {
                dsasClearTimeout("tasks");
                dsasClearTimeout("info");
            }
        });
    }
}

function dsasTaskCertDelete(fingerprint) {
    [...document.getElementsByTagName("dsas-task-cert")]
        .filter((line) => line.getAttribute("fingerprint") === fingerprint)
        .forEach((line) => { line.remove(); });
}

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
        el.addEventListener("click", () => { dsasTaskCertDelete(fingerprint); });
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
