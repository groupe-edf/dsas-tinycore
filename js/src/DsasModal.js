// General DSAS modal display functions used throughout the DSAS

// Relies on "bootstrap.js" being imported first
import { Modal } from "bootstrap";

// These functions are in another file
/* globals _ clear_feedback */

export function modal_message(text, action = null, hide = false) {
    const modalDSAS = document.getElementById("modalDSAS");
    modalDSAS.removeAttribute("disable");
    modalDSAS.removeAttribute("body");
    modalDSAS.removeAttribute("size");
    modalDSAS.removeAttribute("static");
    if (hide) {
        modalDSAS.setAttribute("hideonclick", true);
    } else {
        modalDSAS.removeAttribute("hideonclick");
    }
    if (action) {
        modalDSAS.setAttribute("action", action);
    } else {
        modalDSAS.setAttribute("action", "");
    }
    modalDSAS.setAttribute("title", text);
    modalDSAS.setAttribute("type", "Ok");
    modalDSAS.show();
}

export function modal_action(text, action = null, hide = false) {
    const modalDSAS = document.getElementById("modalDSAS");
    modalDSAS.removeAttribute("disable");
    modalDSAS.removeAttribute("body");
    modalDSAS.removeAttribute("type");
    modalDSAS.removeAttribute("size");
    modalDSAS.removeAttribute("static");
    if (hide) {
        modalDSAS.setAttribute("hideonclick", true);
    } else {
        modalDSAS.removeAttribute("hideonclick");
    }

    if (action) {
        modalDSAS.setAttribute("action", action);
    } else {
        modalDSAS.setAttribute("action", "");
    }
    modalDSAS.setAttribute("title", text);
    modalDSAS.show();
}

export function modal_errors(errors, feedback = false) {
    if (feedback) {
        // Clear old invalid feedbacks
        clear_feedback();
    }

    if (errors && errors !== "Ok") {
        let body = "";
        errors.forEach((err) => {
            if (typeof err === "string" || err instanceof String) { body = body + "<p>" + _(errors) + "</p>"; } else {
                const key = Object.keys(err)[0];
                if (key === "error" || !feedback) {
                    body = body + "<p>" + _(err[Object.keys(err)]) + "</p>";
                } else {
                    document.getElementById(key).setAttribute("class", "form-control is-invalid");
                    document.getElementById("feed_" + key).innerHTML = _(err[key]);
                }
            }
        });
        if (body) { modal_message(body); }
        return true;
    }
    return false;
}

class DSASModal extends HTMLElement {
    connectedCallback() {
        if (!this.rendered) {
            this.render();
            this.rendered = true;
        }
    }

    render() {
        const tag = this.getAttribute("tag");
        const title = this.getAttribute("title");
        const body = this.getAttribute("body");
        const action = this.getAttribute("action");
        const disable = this.getAttribute("disable");
        const type = this.getAttribute("type");
        const hideonclick = this.getAttribute("hideonclick");
        const size = this.getAttribute("size");
        const isStatic = this.getAttribute("static");

        this.innerHTML = "        <div class=\"modal fade\" id=\"static" + tag + "\" " + (isStatic === null || isStatic === true ? "data-bs-backdrop=\"static\" data-bs-keyboard=\"false\" " : "") + "aria-labelledby=\"static" + tag + "Label\" aria-hidden=\"true\">\n"
        + "          <div class=\"modal-dialog" + (size === null || size === "" ? "" : " modal-" + size) + "\">\n"
        + "            <div class=\"modal-content\">\n"
        + "              <div class=\"modal-header\">\n"
        + "                <div id=\"static" + tag + "Label\">" + (title === null ? "" : "<h5 class=\"modal-title\">" + title + "</h5>") + "</div>\n"
        + "              </div>\n"
        + "              " + (body === null ? "<div id=\"body" + tag + "\"></div>" : "<div class=\"modal-body\" id=\"body" + tag + "\">" + body + "</div>") + "\n"
        + "              <div class=\"modal-footer\">\n"
        + (type !== "Ok" ? "                <button type=\"button\" id=\"cancel" + tag + "\" class=\"btn btn-secondary\" data-bs-dismiss=\"modal\""
        + (disable === null ? "" : " disable") + ">" + _("Cancel") + "</button>\n" : "")
        + "                <button type=\"button\" id=\"ok" + tag + "\" class=\"btn btn-primary\""
        + (!action ? "data-bs-dismiss=\"modal\"" : "onclick=\"" + action + "\""
        + (hideonclick === null ? "" : " data-bs-dismiss=\"modal\""))
        + (disable === null ? "" : " disable") + ">" + (type === "Ok" ? _("Ok") : _("Confirm")) + "</button>\n"
        + "              </div>\n"
        + "            </div>\n"
        + "          </div>";
    }

    static get observedAttributes() {
        return ["tag", "title", "body", "action", "disable", "type", "hideonclick", "size", "static"];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        const tag = this.getAttribute("tag");
        const type = this.getAttribute("type");

        if ((name === "tag") || (name === "type") || (name === "action") || (name === "hideonclick") || (name === "size") || (name === "static")) { this.render(); } else {
            switch (name) {
            case "disable":
                if (newValue === null) {
                    document.getElementById("ok" + tag).removeAttribute("disabled");
                    if (type !== "Ok") document.getElementById("cancel" + tag).removeAttribute("disabled");
                } else {
                    document.getElementById("ok" + tag).setAttribute("disabled", "");
                    if (type !== "Ok") document.getElementById("cancel" + tag).setAttribute("disabled", "");
                }
                break;
            case "title":
                if (document.getElementById("static" + tag + "Label")) {
                    document.getElementById("static" + tag + "Label").innerHTML = "<h5 class=\"modal-title\">" + newValue + "</h5>";
                } else {
                    this.render();
                }
                break;
            case "body":
                if (document.getElementById("body" + tag)) {
                    document.getElementById("body" + tag).innerHTML = newValue;
                } else {
                    this.render();
                }
                break;
            default:
                throw new Error("Unknown modal option");
            }
        }
    }

    show() {
        const tag = this.getAttribute("tag");
        const type = this.getAttribute("type");
        const myModal = new Modal(document.getElementById("static" + tag));
        // Focus on "Ok" button, to allow "Enter" to close the modal
        if (type === "Ok") {
            document.getElementById("static" + tag).addEventListener("shown.bs.modal", () => {
                document.getElementById("ok" + tag).focus();
            });
        }
        myModal.show();
    }

    hide() {
    // myModal.hide() doesn't seem to work
        const tag = this.getAttribute("tag");
        const type = this.getAttribute("type");
        if (type === "Ok") {
            document.getElementById("ok" + tag).click();
        } else {
            document.getElementById("cancel" + tag).click();
        }
    }
}

customElements.define("dsas-modal", DSASModal);
