// General DSAS modal display functions used throughout the DSAS
import { Modal } from "bootstrap";
import { _ } from "./MultiLang";

export function modal_message(text, action = null, hide = false) {
    const modalDSAS = document.getElementById("modalDSAS");
    if (modalDSAS) {
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
            modalDSAS.setAction(action);
        } else {
            modalDSAS.setAction();
        }
        modalDSAS.setAttribute("title", text);
        modalDSAS.setAttribute("type", "Ok");
        modalDSAS.show();
    }
}
window.modal_message = modal_message;

export function modal_action(text, action = null, hide = false) {
    const modalDSAS = document.getElementById("modalDSAS");
    if (modalDSAS) {
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
            modalDSAS.setAction(action);
        } else {
            modalDSAS.setAction();
        }
        modalDSAS.setAttribute("title", text);
        modalDSAS.show();
    }
}
window.modal_action = modal_action;

export function modal_errors(errors, feedback = false) {
    if (feedback) {
        // Clear old invalid feedbacks
        // eslint-disable-next-line no-param-reassign
        document.getElementsByClassName("invalid-feedback").forEach((feed) => { feed.innerHTML = ""; });
        document.getElementsByClassName("form-control").forEach((feed) => { feed.setAttribute("class", "form-control"); });
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
window.modal_errors = modal_errors;

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
        const disable = this.getAttribute("disable");
        const type = this.getAttribute("type");
        const hideonclick = this.getAttribute("hideonclick");
        const size = this.getAttribute("size");
        const isStatic = this.getAttribute("static");
        let el;

        this.innerHTML = ""; // Clear all existing elements
        el = this.appendChild(document.createElement("div"));
        el.className = "modal fade";
        el.id = "static" + tag;
        if (isStatic === null || isStatic === true) {
            el.setAttribute("data-bs-backdrop", "static");
            el.setAttribute("data-bs-keyboard", "false");
        }
        el.setAttribute("aria-labelledby", "static" + tag + "Label");
        el.setAttribute("aria-hidden", "true");

        el = el.appendChild(document.createElement("div"));
        if (size === null || size === "") {
            el.className = "modal-dialog";
        } else {
            el.className = "modal-dialog modal-" + size;
        }

        el = el.appendChild(document.createElement("div"));
        el.className = "modal-content";
        const view = el;

        el = view.appendChild(document.createElement("div"));
        el.className = "modal-header";
        el = el.appendChild(document.createElement("div"));
        el.id = "static" + tag + "Label";
        if (title !== null) {
            el.appendChild(document.createElement("h5"));
            el.className = "modal-title";
            el.innerHTML = title;
        }

        el = view.appendChild(document.createElement("div"));
        el.id = "body" + tag;
        el.className = "modal-body";
        if (body !== null) {
            el.innerHTML = body;
        }

        el = view.appendChild(document.createElement("div"));
        el.className = "modal-footer";
        if (type !== "Ok") {
            const el2 = document.createElement("button");
            el2.id = "cancel" + tag;
            el2.className = "btn btn-secondary";
            el2.setAttribute("data-bs-dismiss", "modal");
            if (disable !== null) {
                el2.setAttribute("disable", "");
            }
            el2.innerHTML = _("Cancel");
            el.appendChild(el2);
        }
        {
            // In brackets to limit scope of el2
            const el2 = document.createElement("button");
            el2.id = "ok" + tag;
            el2.className = "btn btn-primary";
            if (disable !== null) {
                el2.setAttribute("disable", "");
            }
            if (!this.action || hideonclick !== null) {
                el2.setAttribute("data-bs-dismiss", "modal");
            }
            el2.innerHTML = (type === "Ok" ? _("Ok") : _("Confirm"));
            if (this.action) {
                if (typeof (this.action) === "string") {
                    // FIXME Should Try not to use this form of the function as it needs
                    // the action to be globally defined. It could also be abused to inject
                    // javascript
                    // eslint-disable-next-line no-eval
                    el2.addEventListener("click", () => { eval(this.action); });
                    console.log("string listener on ok");
                } else {
                    el2.addEventListener("click", this.action);
                    console.log("function listener on ok");
                }
            }
            el.appendChild(el2);
        }
    }

    static get observedAttributes() {
        return ["tag", "title", "body", "disable", "type", "hideonclick", "size", "static"];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        const tag = this.getAttribute("tag");
        const type = this.getAttribute("type");

        if ((name === "tag") || (name === "type") || (name === "hideonclick") || (name === "size") || (name === "static")) { this.render(); } else {
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

    setAction(_action = null) {
        this.action = _action;
        this.render();
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
