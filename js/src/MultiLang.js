// A Class to support multiple languages on webpages and automatically translate
// elements tagged with data-i18n*. Also used to translate in JavaScript via
// MultiLang.translate and to treat translates of formatted strings

// The code https://github.com/BdR76/MultiLanguage was used for inspiration but this
// code has diverged so much that its basically new code

export default class MultiLang {
    constructor(url, onLoad = "", onLang = "", language = "") {
        this.phrases = {};
        this.currentLanguage = language;
        this.onLoad = onLoad;
        this.onLang = onLang;

        fetch(url).then((response) => {
            if (response.ok) { return response.json(); }
            return Promise.reject(new Error(response.statusText));
        }).then((obj) => {
            this.phrases = obj;

            // Is the Language cookie set ?
            let lang = "";
            if (!this.currentLanguage) {
                const cookieArray = document.cookie.split(";");
                for (let i = 0; i < cookieArray.length; i += 1) {
                    const pos = cookieArray[i].indexOf("Language");
                    if (pos > -1) {
                        lang = cookieArray[i].substr(10);
                        if (Object.keys(this.phrases).includes(lang)) {
                            this.currentLanguage = lang;
                        }
                    }
                }
            }

            if (!this.currentLanguage) {
                // The language cookie is not set. Detect browser language as the default
                [this.currentLanguage] = Object.keys(this.phrases);
                const def = (window.navigator.language || window.navigator.userLanguage);
                if (Object.keys(this.phrases).includes(def)) { this.currentLanguage = def; }
            }

            // Set the cookie with the current language if not already in the cookie
            if (lang !== this.currentLanguage) {
                document.cookie = "Language=" + this.currentLanguage
                    + "; expires=Fri 31 Dec 9999 23:59:59;SameSite=Lax";
            }

            // Callback after JSON loading
            if (this.onLoad) { this.onLoad(); }
        }).catch(() => {
            this.phrases = {};
        });
    }

    setLanguage(_lang) {
        if (Object.keys(this.phrases).includes(_lang)) {
            if (this.currentLanguage !== _lang) {
                this.currentLanguage = _lang;
                document.cookie = "Language=" + _lang + "; expires=Fri 31 Dec 9999 23:59:59;SameSite=Lax";
                if (this.onLang) { this.onLang(); } else { window.location.reload(); }
            }
        }
    }

    translate(key, ...args) {
        let str;

        // Modify the prototype of String to allow formatting
        if (!String.format) {
            String.format = function format(f, ...args2) {
                return f.replace(/{(\d+)}/g, (match, number) => (typeof args2[number] !== "undefined" ? args2[number] : match));
            };
        }

        if (!key) { return key; }
        if (typeof (key) === "string") {
            if (this.phrases[this.currentLanguage]) {
                str = this.phrases[this.currentLanguage][key] || key;
            } else {
                str = key;
            }

            if (!args) { return str; }
            return String.format(str, ...args);
        }
        const key0 = key[0];
        if (this.phrases[this.currentLanguage]) {
            str = this.phrases[this.currentLanguage][key0] || key0;
        } else {
            str = key0;
        }

        if (!args) { return String.format(...str); }
        return String.format(...str, ...args);
    }

    translateHTML() {
        // The eslint aribnb style is too annoying for the next 3 lines.
        // eslint-disable-next-line no-param-reassign
        document.querySelectorAll("[data-i18n]").forEach((el) => { el.innerHTML = this.translate(el.innerHTML); });
        // eslint-disable-next-line no-param-reassign
        document.querySelectorAll("[data-i18n-value]").forEach((el) => { el.value = this.translate(el.value); });
        // eslint-disable-next-line no-param-reassign
        document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = this.translate(el.title); });
        // eslint-disable-next-line no-param-reassign
        document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = this.translate(el.placeholder); });

        // Insert language navbar dropdown
        document.querySelectorAll("[data-i18n-navbar-lang]").forEach((el) => {
            const li = el.appendChild(document.createElement("li"));
            li.className = "nav-item dropdown";
            const a = li.appendChild(document.createElement("a"));
            a.className = "nav-link dropdown-toggle";
            a.setAttribute("data-bs-toggle", "dropdown");
            a.innerHTML = this.currentLanguage;
            const d = li.appendChild(document.createElement("div"));
            d.className = "dropdown-menu";

            Object.keys(this.phrases).forEach((e) => {
                const l = d.appendChild(document.createElement("a"));
                l.className = "dropdown-item";
                l.addEventListener("click", (evt) => { this.setLanguage(evt.currentTarget.lang); });
                l.lang = e;
                l.innerHTML = e;
            });
        });
    }
}

// Global ml variable for the translation.
// Use "translateHTML" to force translation of the page. Only elements
// with the "data-i18n" property are translated.
export const ml = new MultiLang(
    "languages.json",
    (() => {
        // Force reload of header as it might have already been rendered
        [...document.getElementsByTagName("dsas-header")].forEach((head) => { head.render(); });
        ml.translateHTML();
    }),
    (() => {
        [...document.getElementsByTagName("dsas-header")].forEach((head) => head.render());
        if ((window.location.pathname === "help.html")
                || (window.location.pathname === "/help.html")) {
            // Special case for help.html
            window.location = "help.html?language=" + this.currentLanguage;
        } else {
            window.location.reload();
        }
    }),
);

// Use "_" as the function name here to be like in python i18n
export function _(...args) {
    return ml.translate(...args);
}
window._ = _;
