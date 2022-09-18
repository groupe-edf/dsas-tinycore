// A class to display a set of very large log files in bootstrap tabs,
// only rendering the minimum number of lines so as to remain rapid.
// Relies on bootstrap for the tabs, etc

export default class DisplayLogs {
    constructor(id, logs, hidescrollbar = false, emphasis = "", filter = "", render = "") {
        const temp = document.getElementById(id);

        this.view = null;
        this.logs = (typeof (logs) === "string" ? [logs] : logs);
        this.emphasis = emphasis;
        this.filter = filter;
        this.render = render;
        this.tab = 0;
        this.lastScrollTop = 0;
        this.hidescrollbar = hidescrollbar;
        this.highlight = { tab: -1, line: -1 };
        this.nitems = this.numberOfItems();

        temp.textContent = ""; // Clear existing content
        if (this.logs.length === 1) {
            let el = temp.appendChild(document.createElement("div"));
            el.id = "logpane";
            el.setAttribute("style", "height: 500px; position: relative; overflow-x: auto; overflow-y: auto;");
            el.appendChild(document.createElement("div")).id = "heightForcer";
            el = el.appendChild(document.createElement("div"));
            el.id = "log0";
            el.className = "container tab-pane active";
        } else {
            let el = temp.appendChild(document.createElement("ul"));
            el.className = "nav nav-tabs";
            el.id = "logs";
            el.setAttribute("role", "tablist");
            for (let i = 0; i < this.logs.length; i += 1) {
                const li = el.appendChild(document.createElement("li"));
                li.className = "nav-item";
                const link = li.appendChild(document.createElement("a"));
                link.className = "nav-link" + (i === 0 ? " active" : "");
                link.id = "navlog" + i;
                link.setAttribute("data-bs-toggle", "tab");
                link.href = "#log" + i;
                link.textContent = i;
            }
            el = temp.appendChild(document.createElement("div"));
            el.id = "logpane";
            el.setAttribute("style", "height: 500px; position: relative; overflow-x: auto; overflow-y: auto;");
            el.appendChild(document.createElement("div")).id = "heightForcer";
            for (let i = 0; i < this.logs.length; i += 1) {
                const div = el.appendChild(document.createElement("div"));
                div.id = "log" + i;
                div.className = "container tab-pane " + (i === 0 ? "active" : "fade");
            }
        }
        this.init_holder();
    }

    init_holder() {
        let i;
        this.holder = document.getElementById("logpane");
        this.height = this.itemHeight();
        if (this.holder && this.height !== 0) {
            this.refreshWindow();
            if (this.holder.addEventListener) {
                this.holder.addEventListener("scroll", this.delayingHandler.bind(this), false);
                if (this.logs.length > 1) {
                    for (i = 0; i < this.logs.length; i += 1) { document.getElementById("navlog" + i).addEventListener("click", this.changeTab.bind(this), false); }
                }
            } else {
                this.holder.attachEvent("onscroll", this.delayingHandler.bind(this));
                if (this.logs.length > 1) {
                    for (i = 0; i < this.logs.length; i += 1) { document.getElementById("navlog" + i).attachEvent("click", this.changeTab.bind(this)); }
                }
            }
        } else { window.requestAnimationFrame(this.init_holder.bind(this)); }
    }

    delayingHandler() {
        if (this.holder) {
            // Don't force refresh if scrolling in the X
            if (this.holder.scrollTop === this.lastScrollTop) { return; }
            this.lastScrollTop = this.holder.scrollTop;
        }
        setTimeout(this.refreshWindow.bind(this), 10);
    }

    changeTab(e) {
        let tab = parseInt(e.target.id.substr(6), 10);
        if (tab > this.logs.length - 1) { tab = this.logs.length - 1; }
        if (tab < 0) { tab = 0; }
        this.tab = tab;
        this.nitems = this.numberOfItems();
        this.refreshWindow();
    }

    itemHeight() {
        const pre = document.createElement("pre");
        pre.textContent = "testing height";
        this.holder.appendChild(pre);

        const output = pre.offsetHeight;
        this.holder.removeChild(pre);
        return output;
    }

    numberOfItems() {
        let output = 0;
        if (this.logs.length === 0) {
            output = 0;
        } else {
            const lines = this.logs[this.tab].split("\n");
            if (this.filter) {
                this.logs[this.tab].split("\n").forEach((line) => {
                    if (line.trim() && this.filter(line)) { output += 1; }
                });
            } else if (lines[lines.length - 1].trim()) {
                output = lines.length;
            } else {
                output = lines.length - 1;
            }
        }
        return output;
    }

    appendlog(logs, tab = 0) {
        if (logs) {
            this.logs[tab] += logs;
            if (this.tab === tab && (this.curItem
                    + Math.ceil(this.holder.offsetHeight / this.height) >= this.nitems)) {
                this.nitems = this.numberOfItems();
                this.refreshWindow();
                this.holder.scrollTop = this.holder.scrollHeight - this.holder.offsetHeight;
            } else if (this.tab === tab) { this.nitems = this.numberOfItems(); }
        }
    }

    search(str = "") {
        if (str !== "") {
            const curIndex = (this.highlight.line < 0 ? this.curItem : this.highlight.line);
            const curTab = (this.highlight.tab < 0 ? this.tab : this.highlight.tab);
            const matches = [];
            let found = 0;
            for (let i = 0; i < this.logs.length; i += 1) {
                let j = 0;
                this.logs[i].split("\n").forEach((line) => {
                    if (!this.filter || this.filter(line)) {
                        if (line.includes(str)) {
                            matches.push({ tab: i, line: j });
                        }
                        j += 1;
                    }
                });
            }
            for (let j = 0; j < matches.length; j += 1) {
                if ((matches[j].tab > curTab) || ((matches[j].tab === curTab)
                    && (matches[j].line > curIndex))) {
                    found = j;
                    break;
                }
            }

            if (matches.length > 0) {
                this.tab = matches[found].tab;
                this.highlight = { tab: this.tab, line: matches[found].line };
                if (this.tab !== curTab) {
                    document.querySelector("#navlog" + this.tab).click();
                    this.nitems = this.numberOfItems();
                }
                this.refreshWindow();
                this.holder.scrollTop = Math.floor(matches[found].line * this.height);
            }
        }
    }

    updatefilter(filter = "") {
        this.filter = filter;
        this.nitems = this.numberOfItems();
        this.hightlight = { tab: -1, line: -1 }; // FIXME : Rather than reset, try to keep same line
        this.refreshWindow();
    }

    color(line) {
        const colors = ["text-muted", "text-dark", "text-info", "text-primary",
            "text-success", "text-warning", "text-danger"];
        let index = (this.emphasis ? this.emphasis(line) : 0);
        index = (index < 0 ? 0 : index);
        index = (index >= colors.length ? colors.length - 1 : index);
        return colors[index];
    }

    refreshWindow() {
        if (this.view != null) { this.view.remove(); }
        if (this.logs.length > 1) { this.view = document.getElementById("log" + this.tab).appendChild(document.createElement("div")); } else { this.view = this.holder.appendChild(document.createElement("div")); }

        if (this.logs.length > 0) {
            let pre;
            if (this.logs[this.tab].length > 0) {
                let lines;
                let index;
                const firstItem = Math.floor(this.holder.scrollTop / this.height);
                let lastItem = firstItem + Math.ceil(this.holder.offsetHeight / this.height);
                if (lastItem + 1 >= this.nitems) { lastItem = this.nitems - 1; }
                this.view.id = "view";
                this.view.style.top = (firstItem * this.height) + "px";
                this.view.style.position = "absolute";
                this.curItem = firstItem;

                if (this.filter) {
                    let line = 0;
                    lines = this.logs[this.tab].split("\n");
                    for (index = 0; index < lines.length; index += 1) {
                        if (this.filter(lines[index])) {
                            if (line >= firstItem) {
                                pre = document.createElement("pre");
                                if ((this.tab === this.highlight.tab)
                                        && (line === this.highlight.line)) {
                                    pre.className = "my-0 bg-info overflow-auto";
                                } else {
                                    pre.className = "my-0 " + this.color(lines[index]) + " overflow-auto";
                                }
                                pre.textContent = (this.render
                                    ? this.render(lines[index])
                                    : lines[index]);
                                this.view.appendChild(pre);
                            }
                            line += 1;
                            if (line > lastItem) { break; }
                        }
                    }
                } else {
                    lines = this.logs[this.tab].split("\n");
                    for (index = firstItem; index <= lastItem; index += 1) {
                        pre = document.createElement("pre");
                        if ((this.tab === this.highlight.tab) && (index === this.highlight.line)) {
                            pre.className = "my-0 bg-info overflow-auto";
                        } else {
                            pre.className = "my-0 " + this.color(lines[index]) + " overflow-auto";
                        }
                        pre.textContent = (this.render ? this.render(lines[index]) : lines[index]);
                        this.view.appendChild(pre);
                    }
                }
            } else {
                pre = document.createElement("pre");
                pre.className = "my-0 text-muted";
                pre.textContent = "<Empty>"; // Can't translate this easily
                this.view.appendChild(pre);
            }
        }
        document.getElementById("heightForcer").style.height = ((this.nitems === 0 ? 1 : this.nitems) * this.height) + "px";
        if (this.hidescrollbar) {
        // work around for non chrome browsers, hides the scrollbar
            this.holder.style.width = (this.holder.offsetWidth * 2 - this.view.offsetWidth) + "px";
        }
    }
}
