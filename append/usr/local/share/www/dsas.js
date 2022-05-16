const dsas_version = "1.1.0"

var timeout_login = 0;
var timeout_status = 0;

function modal_message(text, action = null, hide = false){
  var modalDSAS = document.getElementById("modalDSAS");
  modalDSAS.removeAttribute("disable");
  modalDSAS.removeAttribute("body");
  modalDSAS.removeAttribute("size");
  modalDSAS.removeAttribute("static");
  if (hide)
    modalDSAS.setAttribute("hideonclick", true);
  else
    modalDSAS.removeAttribute("hideonclick");

  if (action) 
    modalDSAS.setAttribute("action", action);
  else
    modalDSAS.setAttribute("action", "");
  modalDSAS.setAttribute("title", text);
  modalDSAS.setAttribute("type", "Ok");
  modalDSAS.show();
}

function modal_info(name, text){
  var modalDSAS = document.getElementById("modalDSAS");
  modalDSAS.removeAttribute("disable");
  modalDSAS.setAttribute("static", false);
  modalDSAS.setAttribute("hideonclick", true);
  modalDSAS.setAttribute("action", "");
  modalDSAS.setAttribute("title", _("Info : {0}", name));
  modalDSAS.setAttribute("type", "Ok");
  modalDSAS.setAttribute("size", "xl");
  modalDSAS.setAttribute("body", "<pre>" + print_obj(text) + "</pre>");
  modalDSAS.show();
}

function modal_action(text, action = null, hide = false){
  var modalDSAS = document.getElementById("modalDSAS");
  modalDSAS.removeAttribute("disable");
  modalDSAS.removeAttribute("body");
  modalDSAS.removeAttribute("type");
  modalDSAS.removeAttribute("size");
  modalDSAS.removeAttribute("static");
  if (hide)
    modalDSAS.setAttribute("hideonclick", true);
  else
    modalDSAS.removeAttribute("hideonclick");
 
  if (action) 
    modalDSAS.setAttribute("action", action);
  else
    modalDSAS.setAttribute("action", "");
  modalDSAS.setAttribute("title", text);
  modalDSAS.show();
}

function modal_task(action = "dsas_add_task();", ca = ""){
  var modalDSAS = document.getElementById("modalDSAS");
  modalDSAS.removeAttribute("disable");
  modalDSAS.removeAttribute("type");
  modalDSAS.removeAttribute("static");
  if (action) 
    modalDSAS.setAttribute("action", action);
  else
    modalDSAS.removeAttribute("action");
  modalDSAS.setAttribute("hideonclick", true);
  modalDSAS.setAttribute("title", _("Add a task"));
  modalDSAS.setAttribute("size", "lg");
  modalDSAS.show();

  fetch("api/dsas-cert.php").then(response => {
    if (response.ok) 
      return response.json();
    else
      return Promise.reject({status: response.status, 
          statusText: response.statusText});
  }).then(certs => {
    var i = 1;
    var certbody = '<option id="TaskAddCert0" value="" selected>' + _("Select a certificate") + '</option>\n';
    for (cert of certs[0].dsas.x509) {
      certbody = certbody + '<option id="TaskAddCert' + i + '" value="' + cert.fingerprint + 
                    '">' + cert_name(cert) + '</option>\n';
      i++;
    }
    for (cert of certs[0].dsas.pubkey) {
      certbody = certbody + '<option  id="TaskAddCert' + i + '" value="' + cert.fingerprint  + 
                    '">' + cert.name + '</option>\n';
      i++;
    }
    for (cert of certs[0].dsas.gpg) {
      certbody = certbody + '<option id="TaskAddCert' + i + '" value="' + cert.fingerprint  + 
                    '">' + cert.uid + '</option>\n';
      i++;
    }
    for (cert of certs[0].ca) {
      certbody = certbody + '<option id="TaskAddCert' + i + '" value="' + cert.fingerprint + 
                    '">' + cert_name(cert) + '</option>\n';
      i++;
    }
    document.getElementById("TaskAddCert").innerHTML = certbody;

    certbody = '        <option id="TaskCA_Base" value=""' + (empty_obj(ca) ? ' selected' : '') + '>' + _("Base CA") + '</option>\n' +
      '        <option id="TaskCA_Self" value="self"' + (ca == "self" ? ' selected' : '') + '>' + _("Self-signed") + '</option>\n';
    for (cert of certs[0].dsas.x509) {
      if (cert_is_ca(cert)) 
        certbody = certbody + '<option id="TaskCACert_' + cert.fingerprint + '" value="' + cert.fingerprint + 
                  '"' + (ca == cert.fingerprint ? ' selected' : '') + '>' + cert_name(cert) + '</option>\n';
    }
    document.getElementById("TaskCA").innerHTML = certbody;
  }).catch(error => {
    if (! fail_loggedin(error.statusText))
      modal_message("Erreur (" + error.status + ") pendant chargement des certificates :\n" + error.statusText);
  });

  modalDSAS.setAttribute("body", '<form>\n' +
'  <div class="row">\n' +
'    <div class="col-6">\n' +
'      <label for="TaskName">' + _("Task name :") + '</label>\n' +
'      <input type="text" id="TaskName" value="" class="form-control">\n' +
'      <div class="invalid-feedback" id="feed_TaskName"></div>\n' +
'    </div>\n' +
'    <div class="col-6">\n' +
'      <label for="TaskDirectory">' + _("Folder used by the task :") + '</label>\n' +
'      <input type="text" id="TaskDirectory" value="" class="form-control">\n' +
'      <div class="invalid-feedback" id="feed_Directory"></div>\n' +
'    </div>\n' +
'    <div class="col-6">\n' +
'      <label for="TaskURI">' + _("URI (no download if empty) :") + '</label>\n' +
'      <input type="text" id="TaskURI" value="" class="form-control">\n' +
'      <div class="invalid-feedback" id="feed_URI"></div>\n' +
'    </div>\n' +
'    <div class="col-6">\n' +
'      <label for="TaskCA">' + _("URI Certification Authority") + '</label>\n' +
'      <select class="form-select" name="TaskCA" id="TaskCA"></select>\n' +
'    </div>\n' +
'    <div class="col-6">\n' +
'      <label for="TaskRun">' + _("Periodicity of the task :") + '</label>\n' +
'      <select class="form-select" name="TaskRun" id="TaskRun">\n' +
'        <option id="TaskRunNull" value="">' + _("Select a period") + '</option>\n' +
'        <option id="TaskRunNever" value="never">' + _("never") + '</option>\n' +
'        <option id="TaskRunQuarterHourly" value="quarterhourly">' + _("quarter hourly") + '</option>\n' +
'        <option id="TaskRunHourly" value="hourly">' + _("hourly") + '</option>\n' +
'        <option id="TaskRunDaily" value="daily">' + _("daily") + '</option>\n' +
'        <option id="TaskRunWeekly" value="weekly">' + _("weekly") + '</option>\n' +
'        <option id="TaskRunMonthly" value="monthly">' + _("monthly") + '</option>\n' +
'      </select>\n' +
'    </div>\n' +
'    <div class="col-6">\n' +
'      <label for="TaskType">' + _("Task type :") + '</label>\n' +
'      <select class="form-select" name="TaskType" id="TaskType" onchange="dsas_add_task_arch();">\n' +
'        <option id="TaskTypeNull" value="">' + _("Select a type") + '</option>\n' +
'        <option id="TaskTypeRPM" value="rpm">rpm</option>\n' +
'        <option id="TaskTypeRepomd" value="repomd">repomd</option>\n' +
'        <option id="TaskTypeDeb" value="deb">deb</option>\n' +
'        <option id="TaskTypeAuth" value="authenticode">authenticode</option>\n' +
'        <option id="TaskTypeLive" value="liveupdate">liveupdate</option>\n' +
'        <option id="TaskTypeCyber" value="cyberwatch">cyberwatch</option>\n' +
'        <option id="TaskTypeSsl" value="openssl">openssl</option>\n' +
'        <option id="TaskTypeGpg" value="gpg">gpg</option>\n' +
'      </select>\n' +
'    </div>\n' +
'    <div class="col-6">\n' +
'      <label for="TaskAddCert">' + _("Add a certificate :") + '</label>\n' +
'      <select class="form-select" name="TaskAddCert" id="TaskAddCert" onchange="dsas_add_task_cert();">\n' +
'              </select>\n' +
'    </div>\n' +
'    <div class="col-6">\n' +
'      <div class="form-check form-check-inline">\n' +
'        <input class="form-check-input" id="TaskArchSource" type="checkbox" value="source" disabled>\n' +
'        <label class="form-check-label" for="TaskArchSource">' + _("Source") + '</label>\n' +
'      </div>\n' +
'      <div class="form-check form-check-inline">\n' +
'        <input class="form-check-input" id="TaskArchAll" type="checkbox" value="all" disabled checked>\n' +
'        <label class="form-check-label" for="TaskArchAll">all</label>\n' +
'      </div>\n' +
'      <div class="form-check form-check-inline">\n' +
'        <input class="form-check-input" id="TaskArchAmd64" type="checkbox" value="amd64" disabled checked>\n' +
'        <label class="form-check-label" for="TaskArchAmd64">amd64</label>\n' +
'      </div>\n' +
'      <div class="form-check form-check-inline">\n' +
'        <input class="form-check-input" id="TaskArchArm64" type="checkbox" value="arm64" disabled>\n' +
'        <label class="form-check-label" for="TaskArchArm64">arm64</label>\n' +
'      </div>\n' +
'      <div class="form-check form-check-inline">\n' +
'        <input class="form-check-input" id="TaskArchArmEL" type="checkbox" value="armel" disabled>\n' +
'        <label class="form-check-label" for="TaskArchArmEL">armel</label>\n' +
'      </div>\n' +
'      <div class="form-check form-check-inline">\n' +
'        <input class="form-check-input" id="TaskArchArmHF" type="checkbox" value="armhf" disabled>\n' +
'        <label class="form-check-label" for="TaskArchArmHF">armhf</label>\n' +
'      </div>\n' +
'      <div class="form-check form-check-inline">\n' +
'        <input class="form-check-input" id="TaskArchI386" type="checkbox" value="i386" disabled>\n' +
'        <label class="form-check-label" for="TaskArchI386">i386</label>\n' +
'      </div>\n' +
'      <div class="form-check form-check-inline">\n' +
'        <input class="form-check-input" id="TaskArchMips64EL" type="checkbox" value="mips64el" disabled>\n' +
'        <label class="form-check-label" for="TaskArchMips64EL">mips64el</label>\n' +
'      </div>\n' +
'      <div class="form-check form-check-inline">\n' +
'        <input class="form-check-input" id="TaskArchMipsEL" type="checkbox" value="mipsel" disabled>\n' +
'        <label class="form-check-label" for="TaskArchMipsEL">mipsel</label>\n' +
'      </div>\n' +
'      <div class="form-check form-check-inline">\n' +
'        <input class="form-check-input" id="TaskArchPpc64EL" type="checkbox" value="ppc64el" disabled>\n' +
'        <label class="form-check-label" for="TaskArchPpc64EL">ppc64el</label>\n' +
'      </div>\n' +
'      <div class="form-check form-check-inline">\n' +
'        <input class="form-check-input" id="TaskArchS390x" type="checkbox" value="s390x" disabled>\n' +
'        <label class="form-check-label" for="TaskArchS390x">s390x</label>\n' +
'      </div>\n' +
'    </div>\n' +
'  </div>\n' +
'  <div class="row">\n' +
'    <div class="col-12">\n' +
'      <label for="TaskCert">' + _("Certificates") + '</label>\n' +
'      <div class="container my-1 border" id="TaskCert"></div>\n' +
'    </div>\n' +
'  </div>\n' +
'</form>');
}

function clear_feedback(){
    for (feed of document.getElementsByClassName("invalid-feedback")) 
       feed.innerHTML = "";
    for (feed of document.getElementsByClassName("form-control")) 
       feed.setAttribute("class", "form-control");
}

function modal_errors(errors, feedback = false){
  if (feedback)
    // Clear old invalid feedbacks
    clear_feedback();
  
  if (errors && errors != "Ok") {
    var body = "";
    for (err of errors)
      if (typeof err === "string" || err instanceof String)
        body = body + "<p>" + _(errors) + "</p>"
      else {
        key = Object.keys(err)[0]
        if (key == "error" || ! feedback) {
          body = body + "<p>" + _(err[Object.keys(err)]) + "</p>";
        } else {
          document.getElementById(key).setAttribute("class", "form-control is-invalid");
          document.getElementById("feed_" + key).innerHTML = _(err[key]);
        }
      }
    if (body)
      modal_message(body);
    return true;
  } else {
     return false;
  }
}

function dsas_loggedin(update_timeout = true, is_admin = true){
  var uri;
  uri  = new URL("api/login.php", window.location.origin);
  uri.search = new URLSearchParams({timeout: update_timeout, admin : is_admin});
  fetch(uri).then(response => {
    if (! response.ok)
      return Promise.reject({status: response.status, 
          statusText: response.statusText});
    else {
      // Check if logged in once every 15 seconds, but don't update the timeout
      timeout_login = setTimeout(dsas_loggedin, 15000, false, is_admin);
    }
  }).catch(error => {
    modal_message(_("You are not connected. Click 'Ok' to reconnect."),
        "window.location='login.html'");
  });
}

function fail_loggedin(status){
  if (status === "Forbidden") {
    modal_message(_("You are not connected. Click 'Ok' to reconnect." ),
        "window.location='login.html'");
    return true;
  } else
    return false;
}

function dsas_init_loggedin(){
  var uri;
  uri  = new URL("api/login.php", window.location.origin);
  uri.search = new URLSearchParams({admin : true });
  fetch(uri).then(response => {
    if (response.ok)
      window.location = "/";
    else {
      uri.search = new URLSearchParams({admin : false });
      fetch(uri).then(response => {
        if (response.ok)
          window.location = "passwd.html";
      }).catch(error => {
        // Catch and ignore errors.
      });
    }
  }).catch(error => {
    // Catch and ignore errors.
  });
}

function dsas_login(){
  var username = document.getElementById("inp_user").value;
  var password = document.getElementById("inp_pass").value;

  // Remove existing errors
  document.getElementById("inp_user").setAttribute("class", "form-control");
  document.getElementById("feed_user").innerHTML = "";
  document.getElementById("inp_pass").setAttribute("class", "form-control");
  document.getElementById("feed_pass").innerHTML = "";

  if (! username) {
    document.getElementById("inp_user").setAttribute("class", "form-control is-invalid");    
    document.getElementById("feed_user").innerHTML =_("Enter the username.");
    return;
  }

  if (! password) {
    document.getElementById("inp_pass").setAttribute("class", "form-control is-invalid");
    document.getElementById("feed_pass").innerHTML = _("Enter the password.");
    return;
  }

  var formData = new FormData();
  formData.append("username", username);
  formData.append("password", password);
  fetch("api/login.php", {method: "POST", body: formData 
    }).then(response => {
      if (response.ok) {
        dsas_init_loggedin();
      } else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).catch(error => {
      document.getElementById("inp_user").setAttribute("class", "form-control is-invalid");
      document.getElementById("inp_pass").setAttribute("class", "form-control is-invalid");
      document.getElementById("feed_pass").innerHTML = _("Username or password invalid.");
    });
}

function dsas_display_passwd(){
  fetch("api/dsas-passwd.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(obj => {
      document.getElementById("User").innerHTML = obj.username;
      document.getElementById("Type").innerHTML = obj.type;
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        if (error.status)
          modal_message(_("Error ({0}) during the machine detection : {1}", error.status, error.statusText));
        else
          modal_message(_("Error : {0}", error));
    });
}

function dsas_change_passwd(){
  var user = document.getElementById("User").innerHTML;
  var passwd = document.getElementById("inp_pass").value;
  var formData = new FormData;
  formData.append("data", JSON.stringify({username : user, passwd : passwd}));
  fetch("api/dsas-passwd.php", {method: "POST", body: formData 
    }).then(response => {
      if (response.ok)
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(text => {
      try {
        const errors = JSON.parse(text);
        modal_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok". 
       clear_feedback();
       modal_message(_("Password successfully changed"));
      }
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error during password change : {0}", error.statusText));
    });
}

function format_space(bytes) {
  // Special case zero
  if (bytes == 0)
    return "0 B";
  else {
    // FIXME : Should I translate the units here ?
    symbols = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    exp = Math.floor(Math.log(bytes)/Math.log(1024));
    return (bytes/Math.pow(1024, Math.floor(exp))).toFixed(2)  + " " + symbols[exp];
  }
}

function dsas_status(){
  fetch("api/dsas-status.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(obj => {
      var body = '<div class="row"><div class="col-6 container p-3 border">' +
        '<h5>' + _("Lower Machine :") + '</h5>' + machine_status(obj.bas);
      if (obj.haut.status == "down")
        body = body + '</div><div class="col-6 container p-3 border text-muted">' +
           '<h5 class="text-danger">' + _("Upper Machine :") + ' ' + _("UNAVAILABLE") + '</h5>' + machine_status(obj.haut) + '</div></div>';
      else
        body = body + '</div><div class="col-6 container p-3 border">' +
           '<h5>' + _("Upper Machine :") + '</h5>' + machine_status(obj.haut) + '</div></div>';
      document.getElementById("StatusBar").innerHTML = body;
      // Automatically refresh the page
      timeout_status = setTimeout(dsas_status, 5000);
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        if (error.status)
          modal_message(_("Error ({0}) during the machine detection : {1}", error.status, error.statusText));
        else
          modal_message(_("Lost contact with the lower machine"));
    });
}

function machine_status(obj){
  var p = 100. - (100. * obj.disk_free) / obj.disk_total;
  var disk = '<div class="d-flex justify-content-between">' +
    '<div>' + _("Disk : {0}", obj.disk) + '</div>\n' +
    '<div>' + format_space(obj.disk_total - obj.disk_free) + 
    ' / ' + format_space(obj.disk_total) + '</div></div>' +
    '  <div class="col-12 progress">\n' +
    '    <div class="progress-bar" role="progressbar" style="width: ' + p.toFixed() +
    '%" aria-valuenow="' + p.toFixed() + '" aria-valuemin="0" aria-valuemax="100">' + p.toFixed(1) + ' %</div>\n' +
    '  </div>\n';
  p = (100. * obj.memory_used) / obj.memory_total;
  var memory = '<div class="d-flex justify-content-between">' +
    '<div>' + _("Memory :") + '</div>\n' +
    '<div>' + format_space(obj.memory_used) + 
    ' / ' + format_space(obj.memory_total) + '</div></div>' +
    '  <div class="col-12 progress">\n' +
    '    <div class="progress-bar" role="progressbar" style="width: ' + p.toFixed() +
    '%" aria-valuenow="' + p.toFixed() + '" aria-valuemin="0" aria-valuemax="100">' + p.toFixed(1) + ' %</div>\n' +
    '  </div>\n';

  if (obj.loadavg < 0.01)
    p = 0;
  else {
    // Scale by the number of cores
    p = (Math.log10(obj.loadavg) + 2) * 25 / obj.cores ;
    p = (p > 100 ? 100 : p);
  }
  var load = '<div class="d-flex justify-content-between">' +
    '<div>' + _("Load average :") + '</div>\n<div>' + obj.loadavg + '</div></div>' +
    '  <div class="col-12 progress">\n' +
    '    <div class="progress-bar" role="progressbar" style="width: ' + p.toFixed() +
    '%" aria-valuenow="' + p.toFixed() + '" aria-valuemin="0" aria-valuemax="100">' + obj.loadavg + '</div>\n' +
    '  </div>\n';

  return disk + memory + load;
}

function dsas_check_warnings(disablenav = false, redirect = true){
  fetch("api/dsas-users.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(obj => {
      if ((obj.first == "true") && redirect)
        window.location = "/passwd.html";
    }).catch(error => {
      fail_loggedin(error.statusText);
    });

  fetch("api/dsas-get-warning.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(obj => {
      if (obj !== null) {
        var warn = "";
        var error = "";
        var body = "";
        for (const line of obj) {
          if (line["type"] === "warn")
            warn = warn + "<p>" + _(line["msg"]);
          else 
            error = error + "<p>" + _(line["msg"]) + "</p>\n";
        }
        if (error) {
          if (disablenav)
            document.getElementsByTagName("dsas-header")[0].setAttribute("disablenav", "disabled")
          body = body + '<p class="text-danger">' + error + '</p>';
        }
        if (warn)
          body = body + '<p class="text-warning">' + warn + '</p>';
        if (body)
          modal_message(body);
      }
    }).catch(error => {
      fail_loggedin(error.statusText);
    });
}

function dsas_togglelogs(all = false){
   var btn = document.getElementById("loghide");
   if (btn.value === _("All logs")) {
     btn.value = _("Errors only");
     DSASLogs.changeAll(false);
   } else {
     btn.value = _("All logs");
     DSASLogs.changeAll(true);
   }
}

var DSASLogs;

function dsas_display_logs(all = false){
  var preLog = document.getElementById("VerifLogs");
  fetch("api/dsas-verif-logs.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(logs => {
      var body = '   <div class="row"><div class="col-md-4">\n' +
                 '     <h5>' + _("Filtered file logs :") + '</h5></div>\n' +
                 '      <div class="col-md-8 text-end">\n' +
                 '        <input type="button" class="btn btn-primary btn-sm" id="loghide" value="' + (all ? _("All logs") : _("Errors only")) + '" onclick="dsas_togglelogs(\'all\');">\n' +
                 '        <input type="button" class="btn btn-primary btn-sm" id="refresh" value="' + _("Refresh") + '" onclick="dsas_display_logs(' + all + ');">\n' +
                 '        <input type="search" class="input-lg rounded"  id="logsearch" placeholder="' +  _("Search") + '" onkeypress="if (event.key === \'Enter\'){ DSASLogs.search(document.getElementById(\'logsearch\').value);}">\n' +
                 '   </div></div>\n';

      if (logs) {
        if (logs.length == 1) {
          body = body + '<div id="logpane"  style="height: 500px; position: relative; overflow-x: hidden; overflow-y: auto;"></div>'; 
        } else {
          body = body + '<ul class="nav nav-tabs" id="logs" role="tablist">\n';
          for (let i = 0; i < logs.length; i++) 
            body = body + '  <li class="nav-item"><a class="nav-link' + (i === 0 ? ' active' : '') + '" id="navlog' + i + '" data-bs-toggle="tab" href="#log' + i + '">' + i + '</a></li>\n';
          body = body + '</ul>\n<div class="tab-content" id="logpane"  style="height: 500px; position: relative; overflow-x: hidden; overflow-y: auto;"></div>';
        }
        preLog.innerHTML = body;
        DSASLogs = new DSASDisplayLogs("logpane", logs);
      } else
        modal_message(_("No logs returned by the DSAS"));
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        if (error.statusText)
          modal_message(_("Error ({0}) during the download of the logs : {1}", error.status, error.statusText));
        else
          modal_message(_("Error ({0}) during the download of the logs : {1}", 0, error));
    });
}

function dsas_verify_line(str){
  var ret = str;
  try {
    var res = _(str.substr(4,15).trim()).padEnd(15);
    var sa = str.substr(20).split(/(\s+)/);
    var hash = sa[0];
    var date = date_to_locale(sa[2]).padEnd(25);
    var path = str.substr(19+sa[0].length+sa[1].length+sa[2].length+sa[3].length);
    ret = res + ' ' + hash + ' ' + date + ' ' + path;
  } catch (e) { }
  return ret;
}

function dsas_display_users(){
  fetch("api/dsas-users.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(obj => {
      users=obj.user;
      body = "";
      for (user of (users.constructor === Object ? [users] : users)) {
        is_tc = user.username === "tc";
        body = body + '<tr><th scope="row" id="username_' + user.username + '">' + user.username + '</th>';
        body = body + '<td><input type="text" id="description_' + user.username + '" value="' + print_obj(user.description) + '" class="form-control"' + (is_tc ? ' disabled readonly' : '') + '></td>';
        body = body + '<td><select class="form-select" name="UserType" id="UserType"' + (is_tc ? ' disabled' : '') + '>' +
          '<option id="admin_' + user.username + '" value="admin"' + (user.type === "admin" ? ' selected' : '') + '>' + _('administrator') + '</option>' +
          '<option id="bas_' + user.username + '" value="bas"' + (user.type === "bas" ? ' selected' : '') + '>' + _('lower') + '</option>' +
          '<option id="haut_' + user.username + '" value="haut"' + (user.type === "haut" ? ' selected' : '') + '>' + _('upper') + '</option>' +
          '</select></td>';
        body = body + '<td style="text-align:center"><input type="checkbox" id="active_' + user.username + '" class="form-check-input"' + (user.active == 'true' ? ' checked' : '') + '></td>';
        body = body + '<td><a data-toggle="tooltip" title="' + _("Change Password") + '" onclick="dsas_user_passwd(\'' + 
          user.username + '\');"><img src="lock.svg"></a>';
        if (! is_tc)
          body = body + '&nbsp;<a data-toggle="tooltip" title="' + _("Delete") + '" onclick="dsas_user_delete(\'' + 
          user.username + '\');"><img src="x-lg.svg"></a>';
        body = body + '</td>';
      }
      document.getElementById("Users").innerHTML = body;
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error ({0}) during the download of users : {1}", error.status, error.statusText));
    });
}

function dsas_user_passwd(user){
  var modalDSAS = document.getElementById("modalDSAS");
  var body = "";
  modal_action(_("Set password for user '{0}'", user), "dsas_real_user_passwd('" + user + "');", true);
  body = '    <div class="col-9 d-flex justify-content-center">\n' +
         '      <label for="UserPassword">' + _("Password :") + '</label>\n' +
         '      <input type="password" id="UserPassword" value="" class="form-control" onkeypress="if (event.key === \'Enter\'){ modalDSAS.hide(); dsas_real_user_passwd(\'' + user + '\');}">\n' +
         '    </div>';
  modalDSAS.setAttribute("body", body);
}

function dsas_real_user_passwd(user){
  var passwd = document.getElementById("UserPassword").value;
  var formData = new FormData;
  formData.append("op", "passwd");
  formData.append("data", JSON.stringify({username : user, passwd : passwd}));
  fetch("api/dsas-users.php", {method: "POST", body: formData 
    }).then(response => {
      if (response.ok)
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(text => {
      try {
        const errors = JSON.parse(text);
        modal_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok". Do nothing
       clear_feedback();
      }
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error during password change : {0}", error.statusText));
    });
}

function dsas_user_delete(user){
  modal_action(_("Delete the user '{0}' ?", user),"dsas_real_user_delete('" + user + "');", true);
}

function dsas_real_user_delete(user){
  var formData = new FormData;
  formData.append("op", "delete");
  formData.append("data", JSON.stringify({username : user}));
  fetch("api/dsas-users.php", {method: "POST", body: formData 
    }).then(response => {
      if (response.ok)
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(text => {
      try {
        const errors = JSON.parse(text);
        modal_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok". 
        clear_feedback();
        dsas_display_users();
      }
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error during user deletion : {0}", error.statusText));
    });
}

function dsas_user_new(){
  var modalDSAS = document.getElementById("modalDSAS");
  var body = "";
  modal_action(_("New username"), 'dsas_real_user_new();', true);
  body = '    <div class="col-9 d-flex justify-content-center">\n' +
         '      <label for="NewUser">' + _("New Username :") + '</label>\n' +
         '      <input type="text" id="NewUser" value="" class="form-control" onkeypress="if (event.key === \'Enter\'){ modalDSAS.hide(); dsas_real_user_new();}">\n' +
         '    </div>';
  modalDSAS.setAttribute("body", body);
}

function dsas_real_user_new(){
  var username = document.getElementById("NewUser").value;
  var formData = new FormData;
  formData.append("op", "add");
  formData.append("data", JSON.stringify({username : username}));
  fetch("api/dsas-users.php", {method: "POST", body: formData 
    }).then(response => {
      if (response.ok)
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(text => {
      try {
        const errors = JSON.parse(text);
        modal_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok".
        clear_feedback();
        dsas_display_users();
      }
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error during user creation : {0}", error.statusText));
    });
}

function dsas_change_users(){
  fetch("api/dsas-users.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(obj => {
      users=obj.user;
      var data = [];
      for (user of (users.constructor === Object ? [users] : users)) {
        username = user.username;
        description = document.getElementById("description_" + username).value;
        for (opt of document.getElementsByTagName("option")) {
          if (opt.id === ("admin_" + username) && opt.selected)
            type = "admin";
          if (opt.id === ("bas_" + username) && opt.selected)
            type = "bas";
          if (opt.id === ("haut_" + username) && opt.selected)
            type = "haut";
        }
        active = (document.getElementById("active_" + username).checked ? "true" : "false");
        data.push({username : username, description :  description, type : type, active : active});
      }

      var formData = new FormData;
      formData.append("op", "modify");
      formData.append("data", JSON.stringify(data));
      fetch("api/dsas-users.php", {method: "POST", body: formData 
        }).then(response => {
          if (response.ok)
            return response.text();
          else
            return Promise.reject({status: response.status, 
                statusText: response.statusText});
        }).then(text => {
          try {
            const errors = JSON.parse(text);
            modal_errors(errors);
          } catch (e) {
            // Its text => here always just "Ok".
            clear_feedback();
            modal_message(_("Changes successfully saved"));
          }
        }).catch(error => {
          if (! fail_loggedin(error.statusText))
            modal_message(_("Error during user creation : {0}", error.statusText));
        });
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error ({0}) during the download of users : {1}", error.status, error.statusText));
    });
}

function dsas_display_web(what = "all"){
  fetch("api/dsas-web.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(web => {
      if (what === "all" || what === "cert") {
        document.getElementById("web_csr").innerHTML = '  <h5><a class="text-toggle" data-bs-toggle="collapse" href="#csr"\n' +
            '    role="button" aria-controls="csr" aria-expanded="false"> \n' +
            '    <i class="text-collapsed"><img src="caret-right.svg"/></i><i class="text-expanded">\n' +
            '    <img src="caret-down.svg"/></i></a>' + _("Certificate Signing Request") + '\n' +
            '    <a data-toggle="tooltip" title="' + _("Download") + '" id="getcsr" download="dsas.csr"><img src="save.svg"></a></h5>\n' +
            '  <div class="collapse" id="csr">\n' +
            '     <div class="card card-body">\n' +
            '        <pre id="csr_body" style="height : 300px"></pre>\n' +
            '        <form id="crtupload">\n' +
            '            <label for="upload" data-toggle="tooltip" title="' + _("CSR file signed by a CA") + '">' + _("Upload CRT") + '</label>\n' +
            '            <input type="file" name="crtfile" id="crtfile" style="display: none"\n' +
            '              accept="text/plain,application/x-x509-user-cert" onchange="dsas_upload_crt();">\n' +
            '            <input type="submit" class="btn btn-primary btn-sm" name="upload" value="' + _("Upload") + '"\n' +
            '              onclick="document.getElementById(\'crtfile\').click(); return false;">\n' +
            '        </form></div></div>\n';

        var csrblob = new Blob([web.ssl.csr], {type : "application/x-x509-user-cert"});
        var csrurl = window.URL.createObjectURL(csrblob);
        document.getElementById("csr_body").innerHTML = web.ssl.csr;
        document.getElementById("getcsr").setAttribute("href", csrurl);

        document.getElementById("web_pem").innerHTML = '  <h5><a class="text-toggle" data-bs-toggle="collapse" href="#cert"\n' +
            '    role="button" aria-controls="cert" aria-expanded="false">\n' +
            '    <i class="text-collapsed"><img src="caret-right.svg"/></i><i class="text-expanded">\n' +
            '    <img src="caret-down.svg"/></i></a>' + _("Public Certificate") + 
            '    <a data-toggle="tooltip" title="' + _("Download") + '" id="getpem" download="dsas.crt"><img src="save.svg"></a></h5>\n' +
            '  <div class="collapse" id="cert">\n' +
            '    <div class="card card-body">\n' +
            '      <pre id="pem_body" style="height : 300px"></pre>\n' +
            '    </div>\n' +
            '  </div>';
        var pemblob = new Blob([web.ssl.pem], {type : "application/x-x509-user-cert"});
        var pemurl = window.URL.createObjectURL(pemblob);
        document.getElementById("pem_body").innerHTML = web.ssl.pem;
        document.getElementById("getpem").setAttribute("href", pemurl);

        document.getElementById("web_renew").innerHTML = _("Renew certificate");
        document.getElementById("web_email").innerHTML = _("email");
        document.getElementById("web_validity").innerHTML = _("Validity");
        document.getElementById("web_renew2").value = _("Renew certificate");
        document.getElementById("validity").innerHTML = '<option id="valid0" value="0" selected>' + _("Years") + '</option>\n' +     
              '<option id="valid1" value="1">' + _("One year") + '</option>\n' +
              '<option id="valid2" value="2">' + _("Two years") + '</option>\n' +
              '<option id="valid3" value="3">' + _("Three years") + '</option>\n' +
              '<option id="valid4" value="4">' + _("Four years") + '</option>\n' +
              '<option id="valid5" value="5">' + _("Five years") + '</option>\n';                 

        for (fld of ["countryName", "stateOrProvinceName", "localityName", 
              "organizationName", "organizationalUnitName", "commonName", "emailAddress"]) {
          if (Object.keys(web.ssl[fld]).length !== 0)
            document.getElementById(fld).value = web.ssl[fld];
          else
            document.getElementById(fld).value = "";
        }
        validity = parseInt(web.ssl.validity);    
        for (let i = 1; i <= 5; i++) {
          if (validity  === i)
             document.getElementById("valid" + i).setAttribute("selected", "");
        }
      }
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error while loading the page : {0}", (error.statusText ? error.statusText : error)));
    });
}

function dsas_renew_cert(){
    modal_action(_("Are you sure you want to renew the certificate ?"),
        "dsas_renew_cert_real();", true);
}

function dsas_renew_cert_real(){
  fetch("api/dsas-web.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(web => {
      var formData = new FormData;
      formData.append("op", "renew");
      for (fld of ["countryName", "stateOrProvinceName", "localityName", 
           "organizationName", "organizationalUnitName", "commonName", "emailAddress"])
        formData.append(fld, document.getElementById(fld).value);
      var valid = 0;
      for (let i = 0; i <= 5; i++) {
        if (document.getElementById("valid" + i).selected) {
          valid = i;
          break;
        }
      }
      formData.append("validity", valid);

      fetch("api/dsas-web.php", {method: "POST", body: formData 
        }).then(response => {
          if (response.ok) 
            return response.text();
          else
            return Promise.reject({status: response.status, 
                statusText: response.statusText});
        }).then(text => {
          try {
            const errors = JSON.parse(text);
            modal_errors(errors);
            dsas_display_web("cert");
          } catch (e) {
            // Its text => here always just "Ok"
            clear_feedback();
            dsas_display_web("cert");
          }
        });
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error while loading the page : {0}", (error.statusText ? error.statusText : error)));
    });
}

function dsas_upload_crt() {
  var crt = document.getElementById("crtupload");
  var formData = new FormData();
  formData.append("op", "upload");
  formData.append("file", crt[0].files[0]);

  fetch("api/dsas-web.php", {
    method: 'POST',
    body: formData}).then(response => {
      if (response.ok) 
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(text => {
      try {
        const errors = JSON.parse(text);
        modal_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok"
        clear_feedback();
        modal_message(_("CRT successfully uploaded"), "dsas_display_web('cert');", true);
      }
    }).catch(error => {
      if (!fail_loggedin(error.statusText))
        modal_message(_("Error while loading the page : {0}", (error.statusText ? error.statusText : error)));
    }); 
}

function dsas_display_net(what = "all"){
  fetch("api/dsas-net.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(net => {
     if (what === "ifaces" || what === "all") {
       var i = 0;
       var body = '<h5>' +_("Network configuration") + '</h5>\n' + 
           '<form class="row g-2">\n' +
           '  <div class="container p-3 my-3 border" id="IFaces">';
       for (iface2 of ["bas", "haut"]) {
         iface = net[iface2];
         body = body +
            '<p class="my-0"><a class="text-toggle" data-bs-toggle="collapse" href="#iface' + i +
            '" role="button"' + 'aria-controls="iface' + i + '" aria-expanded="false">' +
            '<i class="text-collapsed"><img src="caret-right.svg"/></i>' +
            '<i class="text-expanded"><img src="caret-down.svg"/></i></a>' + 
             (iface2 == "bas" ? _("Lower Machine") : _("Upper Machine"));
         body = body + 
            '</p><div class="collapse" id="iface' + i + '"><div class="card card-body">' +
            iface_body(iface, i) + '</div></div>\n';
         i++;
       }
       body = body + '</div><div class="form-group">\n' +
           '  <input type="submit" class="btn btn-primary" value="' + _("Save the changes") + '" onclick="dsas_change_net(); return false;">\n' +
           '</div></form>';  

       document.getElementById("network").innerHTML = body;

       // Why can't I include this in the declaration of the body ?
       i = 0; 
       for (iface of [net.bas, net.haut]) { 
         var dns_servers = "";
         if (! empty_obj(iface.dns.nameserver))
           for (ns of (iface.dns.nameserver.constructor === Array ? 
                 iface.dns.nameserver : [iface.dns.nameserver]))
             dns_servers = dns_servers + ns + "\n";
         document.getElementById("iface_nameserver" + i).value = dns_servers;
         i++;
       }
     }
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error while loading the page : {0}", (error.statusText ? error.statusText : error)));
    });
}

function iface_body(iface, i) {
   var dhcp = (iface.dhcp === "true");

   return '<div class="row">\n' +
    '  <div class="col-6">\n' +
    '    <div class="row">\n' +
    '      <div class="col-12">\n' +
    '        <input class="form-check-input" type="checkbox"' + (dhcp ? ' checked=""' : '') + ' id="iface_dhcp' + i + 
              '" onchange="dsas_change_net(\'dhcp\', ' + i + ');">\n' +
    '        <label class="form-check-label" for="iface_dhcp' + i + '">' + _("Use DHCP") + '</label>\n' +
    '      </div>\n' +
    '      <div class="col-12">\n' +
    '        <label for="iface_cidr' + i + '">' + _("IP address and mask (CIDR format)") + '</label>\n' +
    '        <input type="text" id="iface_cidr' + i + '"' + (dhcp ? ' disabled=""' : '') + ' value="' + print_obj(iface.cidr) + '" class="form-control">\n' +
    '        <div class="invalid-feedback" id="feed_iface_cidr' + i + '"></div>\n' +
    '      </div>\n' +
    '      <div class="col-12">\n' +
    '        <label for="iface_gateway' + i + '">' + _("Gateway") + '</label>\n' +
    '        <input type="text" id="iface_gateway' + i + '"' + (dhcp ? ' disabled=""' : '') + ' value="' + print_obj(iface.gateway) + '" class="form-control">\n' +
    '        <div class="invalid-feedback" id="feed_iface_gateway' + i + '"></div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div class="col-6">\n' +
    '    <div class="row">\n' +
    '      <div class="col-12">\n' +
    '        <label for="iface_dns_domain' + i + '">' + _("DNS domain") + '</label>\n' +
    '        <input type="text" id="iface_dns_domain' + i + '"' + (dhcp ? ' disabled=""' : '') + ' value="' + print_obj(iface.dns.domain) + '" class="form-control">\n' +
    '        <div class="invalid-feedback" id="feed_iface_dns_domain' + i + '"></div>\n' +
    '      </div>\n' +
    '      <div class="form-check col-12">\n' +
    '        <label for="iface_nameserver' + i + '">' + _("DNS name servers") + '</label>\n' +
    '        <textarea name="iface_nameserver' + i + '"' + (dhcp ? ' disabled=""' : '') + ' rows="3" id="iface_nameserver' + i + '" class="form-control"></textarea>\n' +
    '        <div class="invalid-feedback" id="feed_iface_nameserver' + i + '"></div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>';
}

function dsas_change_net(what= "all", i = 0) { 
  if (what === "dhcp") {
     document.getElementById("iface_cidr" + i).disabled = 
       document.getElementById("iface_gateway" + i).disabled = 
       document.getElementById("iface_dns_domain" + i).disabled = 
       document.getElementById("iface_nameserver" + i).disabled =  
           document.getElementById("iface_dhcp" + i).checked;
  } else {
    fetch("api/dsas-net.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
      }).then(net => {
        j = 0;
        for (iface2 of ["bas", "haut"]) {
          iface = net[iface2];
          iface.dhcp = (document.getElementById("iface_dhcp" + j).checked ? "true" : "false");
          iface.cidr = document.getElementById("iface_cidr" + j).value;
          iface.gateway = document.getElementById("iface_gateway" + j).value;
          iface.dns.domain = document.getElementById("iface_dns_domain" + j).value;
          server = [];
          for (s of document.getElementById("iface_nameserver" + j).value.split(/((\r?\n)|(\r\n?))/)) {
            s = (s ? s.trim() : "");
            if (s) {
              server.push(s);
            }
          }
          iface.dns.nameserver = server;
          j++;
        }

        var formData = new FormData;
        formData.append("op", "all");
        formData.append("data", JSON.stringify(net));
        fetch("api/dsas-net.php", {method: "POST", body: formData 
          }).then( response => {
            if (response.ok) 
              return response.text();
            else
              return Promise.reject({status: response.status, 
                statusText: response.statusText});
          }).then(text => {
            try {
              const errors = JSON.parse(text);
              modal_errors(errors, true);
            } catch (e) {
              // Its text => here always just "Ok"
              clear_feedback();
              dsas_display_net("all");
            }
          }).catch(error => {
            modal_message(_("Error while loading the page : {0}", (error.statusText ? error.statusText : error)));
          });

      }).catch(error => {
        fail_loggedin(error.statusText);
      });
  }
}

function dsas_display_service(what = "all"){
  fetch("api/dsas-service.php").then(response => {
    if (response.ok) 
      return response.json();
    else
      return Promise.reject({status: response.status, 
          statusText: response.statusText});
    }).then(serv => {
     if (what === "ssh" || what === "all") {
       document.getElementById("ssh").checked = (serv.ssh.active === "true");
       document.getElementById("user_tc").value = print_obj(serv.ssh.user_tc);
       document.getElementById("user_tc").disabled = (serv.ssh.active !== "true");
       document.getElementById("user_bas").value = print_obj(serv.ssh.user_bas);
       document.getElementById("user_bas").disabled = (serv.ssh.active !== "true");
       document.getElementById("user_haut").value = print_obj(serv.ssh.user_haut);
       document.getElementById("user_haut").disabled = (serv.ssh.active !== "true");
     }
     if (what === "syslog" || what === "all") {
       document.getElementById("syslog").checked = (serv.syslog.active === "true");
       document.getElementById("syslog_server").value = print_obj(serv.syslog.server);
       document.getElementById("syslog_server").disabled = (serv.syslog.active !== "true");
     }
     if (what === "ntp" || what === "all") {
       var pool = "";
       if (! empty_obj(serv.ntp.server)) {
         for (s of (serv.ntp.server.constructor === Array ? 
             serv.ntp.server : [serv.ntp.server]))
           pool = pool + s + "\n";
       }
       document.getElementById("ntp").checked = (serv.ntp.active === "true");
       document.getElementById("ntp_pool").value = pool;
       document.getElementById("ntp_pool").disabled = (serv.ntp.active !== "true");
     }
     if (what === "antivirus" || what === "all") {
       document.getElementById("antivirus").checked = (serv.antivirus.active === "true");
       document.getElementById("antivirus_uri").value = print_obj(serv.antivirus.uri);
       document.getElementById("antivirus_uri").disabled = (serv.antivirus.active !== "true");
     }
     if (what === "repo" || what === "all") {
       document.getElementById("repo").checked = (serv.web.repo === "true");
     }
     if (what === "snmp" || what === "all") {
       document.getElementById("snmp").checked = (serv.snmp.active === "true");
       document.getElementById("snmp_user").value = print_obj(serv.snmp.username);
       document.getElementById("snmp_user").disabled = (serv.snmp.active !== "true");
       document.getElementById("snmp_pass").value = print_obj(serv.snmp.password);
       document.getElementById("snmp_pass").disabled = (serv.snmp.active !== "true");
       document.getElementById("snmp_encrypt").value = print_obj(serv.snmp.encrypt);
       document.getElementById("snmp_encrypt").disabled = (serv.snmp.active !== "true");
       document.getElementById("snmp_passpriv").value = print_obj(serv.snmp.passpriv);
       document.getElementById("snmp_passpriv").disabled = (serv.snmp.active !== "true");
       document.getElementById("snmp_privencrypt").value = print_obj(serv.snmp.privencrypt);
       document.getElementById("snmp_privencrypt").disabled = (serv.snmp.active !== "true");
     }
  }).catch(error => {
      fail_loggedin(error.statusText);
  });
}

function dsas_change_service(what) {
  if (what === "ssh") {
     document.getElementById("user_tc").disabled = 
       document.getElementById("user_bas").disabled = 
       document.getElementById("user_haut").disabled =  ! document.getElementById("ssh").checked;
  } else if (what === "syslog") {
    document.getElementById("syslog_server").disabled = ! document.getElementById("syslog").checked;
  } else if (what === "ntp") {
    document.getElementById("ntp_pool").disabled = ! document.getElementById("ntp").checked;
  } else if (what === "antivirus") {
    document.getElementById("antivirus_uri").disabled = ! document.getElementById("antivirus").checked;
  } else if (what === "snmp") {
    document.getElementById("snmp_user").disabled = ! document.getElementById("snmp").checked;
    document.getElementById("snmp_pass").disabled = ! document.getElementById("snmp").checked;
  } else if (what !== "repo") {
    fetch("api/dsas-service.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
      }).then(serv => {
       op = "all";
       serv.ssh.active = (document.getElementById("ssh").checked ? "true" : "false");
       serv.ssh.user_tc = document.getElementById("user_tc").value;
       serv.ssh.user_bas = document.getElementById("user_bas").value;
       serv.ssh.user_haut = document.getElementById("user_haut").value;
       serv.syslog.active = (document.getElementById("syslog").checked ? "true" : "false");
       serv.syslog.server = document.getElementById("syslog_server").value;
       serv.ntp.active = (document.getElementById("ntp").checked ? "true" : "false");
       serv.web.repo = (document.getElementById("repo").checked ? "true" : "false");

       serv.snmp.active = (document.getElementById("snmp").checked ? "true" : "false");
       serv.snmp.username = document.getElementById("snmp_user").value;
       serv.snmp.password = document.getElementById("snmp_pass").value;
       for (opt of document.getElementsByTagName("option")) {
         switch (opt.id) {
           case "snmp_md5":
           case "snmp_sha":
           case "snmp_sha256":
           case "snmp_sha512":
             if (opt.selected)
               serv.snmp.encrypt = opt.value;
             break;
         }
       }
       serv.snmp.passpriv = document.getElementById("snmp_passpriv").value;
       for (opt of document.getElementsByTagName("option")) {
         switch (opt.id) {
           case "snmp_des":
           case "snmp_aes":
           case "snmp_aes192":
           case "snmp_aes192c":
           case "snmp_aes256":
           case "snmp_aes256c":
             if (opt.selected)
               serv.snmp.privencrypt = opt.value;
             break;
         }
       }

       server = [];
       for (s of document.getElementById("ntp_pool").value.split(/((\r?\n)|(\r\n?))/)) {
         s = (s ? s.trim() : "");
         if (s) {
           server.push(s);
         }
       }
       serv.ntp.server = server;
       serv.antivirus.active = (document.getElementById("antivirus").checked ? "true" : "false");
       serv.antivirus.uri = document.getElementById("antivirus_uri").value;
 
       var formData = new FormData;
       formData.append("op", "all");
       formData.append("data", JSON.stringify(serv));
       fetch("api/dsas-service.php", {method: "POST", body: formData 
         }).then( response => {
           if (response.ok) 
             return response.text();
           else
             return Promise.reject({status: response.status, 
               statusText: response.statusText});
         }).then(text => {
           try {
             const errors = JSON.parse(text);
             modal_errors(errors, true);
           } catch (e) {
             // Its text => here always just "Ok"
             clear_feedback();
             modal_message(_("Changes successfully saved"));
           }
         }).catch(error => {
           modal_message(_("Error : {0}", (error.statusText ? error.statusText : error)));
         });
     }).catch(error => {
       fail_loggedin(error.statusText);
     });
  }
}

function dsas_display_cert(what = "all"){
  fetch("api/dsas-cert.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(certs => {
      if (what === "all" || what === "ca")
        document.getElementById("ca").innerHTML = treat_x509_certs(certs[0].ca);
      if (what === "all" || what === "cert")
        document.getElementById("cert").innerHTML = treat_x509_certs(certs[0].dsas.x509, true);
      if (what === "all" || what === "pubkey")
        document.getElementById("pubkey").innerHTML = treat_ssl_pubkeys(certs[0].dsas.pubkey, true);
      if (what === "all" || what === "gpg")
        document.getElementById("gpg").innerHTML = treat_gpg_certs(certs[0].dsas.gpg);
  
    }).catch(error => {
      fail_loggedin(error.statusText);
    });
}

function escapeHtml(unsafe) {
  return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

function treat_gpg_certs(certs) {
  body = "";
  i = 0;
  for (cert of certs) {
    var pemblob = new Blob([cert.pem], {type : "application/x-x509-user-cert"});
    var url = window.URL.createObjectURL(pemblob);
    name = cert.uid;
    cls = (cert_expired(cert) ? "text-danger" : (cert_expiring(cert) ? "text-warning" : "text"));

    body = body +
      '<p class="my-0 ' + cls + '"><a class="text-toggle" data-bs-toggle="collapse" href="#gpg' + i + '" role="button"' + 
      'aria-controls="gpg' + i + '" aria-expanded="false">' +
      '<i class="text-collapsed"><img src="caret-right.svg"/></i>' +
      '<i class="text-expanded"><img src="caret-down.svg"/></i></a>' + escapeHtml(name) + 
      '&nbsp;<a data-toggle="tooltip" title="' + _("Download") + '" href="' + url + '" download="' + name.replace(/ /g,"_") + '.gpg">' + 
      '<img src="save.svg"></a>';
    body = body + '&nbsp;<a data-toggle="tooltip" title="' + _("Delete") + '" onclick="dsas_cert_delete(\'' + name.replaceAll('\n','\\n') + '\',\'' + 
        cert.fingerprint + '\');"><img src="x-lg.svg"></a>';
    body = body + 
      '</p><div class="collapse" id="gpg' + i + '"><div class="card card-body">' +
      '<pre style="height : 210px">' + gpg_body(cert) + '</pre></div></div>\n';
    i++;
  }
  return body;
}

function gpg_body(cert) {
  delete cert["pem"];  // Don't display the PEM file, download button for that
  // Convert ValidFrom and ValidTo de something human readable
  cert.VaildFrom = time_t_to_date(cert.created);
  cert.VaildTo = time_t_to_date(cert.expires);
  return JSON.stringify(cert, null, 2);
}

function time_t_to_date(t) {
  if (t <= 0)
    return _("always");
  else {
  d = new Date(t * 1000);
  return d.toUTCString();
  }
}

function treat_ssl_pubkeys(pubkeys) {
  body = "";
  i = 0;
  for (pubkey of pubkeys) {
    var pemblob = new Blob([pubkey.pem], {type : "application/x-pem-file"});
    var url = window.URL.createObjectURL(pemblob);
    name = pubkey.name;
    body = body +
      '<p class="my-0"><a class="text-toggle" data-bs-toggle="collapse" href="#pubkey' + i + '" role="button"' + 
      'aria-controls="pubkey' + i + '" aria-expanded="false">' +
      '<i class="text-collapsed"><img src="caret-right.svg"/></i>' +
      '<i class="text-expanded"><img src="caret-down.svg"/></i></a>' + name + 
      '&nbsp;<a data-toggle="tooltip" title="' + _("Download") + '" href="' + url + '" download="' + name.replace(/ /g,"_")  + '.pem">' + 
      '<img src="save.svg"></a>';
    body = body + '&nbsp;<a data-toggle="tooltip" title="' + _("Delete") + '" onclick="dsas_cert_delete(\'' + name.replaceAll('\n','\\n') + '\',\'' + 
        pubkey.fingerprint + '\');"><img src="x-lg.svg"></a>';
    body = body + 
      '</p><div class="collapse" id="pubkey' + i + '"><div class="card card-body">' +
      '<pre style="height : 20px">fingerprint : ' + pubkey.fingerprint + '</pre></div></div>\n';
    i++;
  }
  return body;
}

function treat_x509_certs(certs, added = false) {
  body = "";
  i = 0;
  for (cert of certs) {
    var pemblob = new Blob([cert.pem], {type : "application/x-x509-user-cert"});
    var url = window.URL.createObjectURL(pemblob);
    name = cert_name(cert);
    cls = (cert_expired(cert) ? "text-danger" : (cert_expiring(cert) ? "text-warning" : (cert_is_ca(cert) ? "text" : "text-info")));

    body = body +
      '<p class="my-0 ' + cls + '"><a class="text-toggle" data-bs-toggle="collapse" href="#' + (added ? 'add' : 'ca') + i + '" role="button"' + 
      'aria-controls="ca' + i + '" aria-expanded="false">' +
      '<i class="text-collapsed"><img src="caret-right.svg"/></i>' +
      '<i class="text-expanded"><img src="caret-down.svg"/></i></a>' + name + 
      '&nbsp;<a data-toggle="tooltip" title="' + _("Download") + '" href="' + url + '" download="' + name.replace(/ /g,"_") + '.crt">' + 
      '<img src="save.svg"></a>';
    if (added)
      body = body + '&nbsp;<a data-toggle="tooltip" title="' + _("Delete") + '" onclick="dsas_cert_delete(\'' + name.replaceAll('\n','\\n') + '\',\'' + 
        cert.fingerprint + '\');"><img src="x-lg.svg"></a>';
    body = body + 
      '</p><div class="collapse" id="' + (added ? 'add' : 'ca') + i + '"><div class="card card-body">' +
      '<pre style="height : 300px">' + cert_body(cert) + '</pre></div></div>\n';
    i++;
  }
  return body;
}

function dsas_cert_delete(name, finger){
  modal_action(_("Delete the certificate ?<br><small>&nbsp;&nbsp;Name : {0}<br>&nbsp;&nbsp;ID : {1}</small>", name, finger.substr(0,50)),
     "dsas_cert_real_delete('" + name + "','" + finger + "');", true);
}

function dsas_cert_real_delete(name, finger) {
  var formData = new FormData;
  formData.append("op", "delete");
  formData.append("finger", finger);
  fetch("api/dsas-cert.php", {method: "POST", body: formData 
    }).then( response => {
      if (response.ok) 
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(text => {
      try {
        const errors = JSON.parse(text);
        modal_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok"
        clear_feedback();
        dsas_display_cert("cert");
        dsas_display_cert("pubkey");
        dsas_display_cert("gpg");
      }
    }).catch(error => {
        modal_message(_("Error : {0}", (error.statusText ? error.statusText : error)));
    });
}

function cert_expiring(cert) {
  // JS is time_t times 1000 'cause in milliseconds
  var tt = cert['validTo_time_t'];
  tt = tt * 1000;

  // EDF CA has à value of -1. What does that even mean !!
  if (tt < 0) return false;
  // Expiring if less than 6 months are left 
  if (tt - Date.now() < 180 * 24 * 3600000)
    return true;
  return false; 
}

function cert_expired(cert) {
  var tt = cert.validTo_time_t * 1000;
  if (tt < 0) return false;
  if (tt - Date.now() < 0)
    return true;
  return false; 
}

function cert_is_ca(cert) {
  if (! cert.extensions.authorityKeyIdentifier ||
        cert.extensions.authorityKeyIdentifier.indexOf(cert.extensions.subjectKeyIdentifier) >= 0)
     return true;
   else
     return false;
}

function cert_name(cert) {
  if (cert.subject.CN)
    return cert.subject.CN;
  if (cert.subject.OU)
    return cert.subject.OU;
  if (cert.subject.O)
    return cert.subject.O;
  if (cert.extensions.subjectKeyIdentifier)
    return cert.extensions.subjectKeyIdentifier;
  return "name";
}

function cert_body(cert) {
  delete cert["pem"];  // Don't display the PEM file, download button for that
  // Convert ValidFrom and ValidTo de something human readable
  cert.validFrom = date_to_str(cert.validFrom);
  cert.validTo = date_to_str(cert.validTo);

  // Tidy up the purposes, which I find ugly for the PHP openssl_x509_parse function
  purposes = [];
  for (key of Object.keys(cert.purposes))
    purposes.push(cert.purposes[key][2]);
  cert.purposes = purposes

  return JSON.stringify(cert, null, 2);
}

function date_to_str(d) {
  // Example : Convert '170131235959Z' to '31 jan 2017 23:58:59. Asume always "Z" = UTC
  return d.substr(4,2) + " " + ["jan", "f&eacute;v", "mar", "avr", "mai", "jun", "jul", 
     "aou", "sep", "oct", "nov", "d&eacute;c"][Number(d.substr(2,2)) - 1] + " 20" + 
      d.substr(0,2) + " " + d.substr(6,2) + ":" + d.substr(8,2) + ":" + d.substr(10,2) + " UTC";
}

function dsas_pubkey_name(){
  var modalDSAS = document.getElementById("modalDSAS");
  var body = "";
  modal_action(_("Enter name for public key"), 'dsas_upload_cert("pubkey", document.getElementById("PubkeyName").value);', true);
  body = '    <div class="col-9 d-flex justify-content-center">\n' +
         '      <label for="PubkeyName">' + _("Name :") + '</label>\n' +
         '      <input type="text" id="PubkeyName" value="" class="form-control" onkeypress="if (event.key === \'Enter\'){ modalDSAS.hide(); dsas_upload_cert(\'pubkey\', document.getElementById(\'PubkeyName\').value);}">\n' +
         '    </div>';
  modalDSAS.setAttribute("body", body);
}

function dsas_upload_cert(type = "x509", name ="") {
  var cert = document.getElementById(type + "upload");
  var formData = new FormData();
  formData.append("op", type + "_upload");
  formData.append("file", cert[0].files[0]);
  formData.append("name", name);

  fetch("api/dsas-cert.php", {
    method: 'POST',
    body: formData}).then(response => {
      if (response.ok) 
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(text => {
      try {
        const errors = JSON.parse(text);
        modal_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok"
        clear_feedback();
        modal_message(_("Certificate successfully sent"), "dsas_display_cert();", true);
      }
    }).catch(error => {
      if (!fail_loggedin(error.statusText))
        modal_message(_("Error : {0}", (error.statusText ? error.statusText : error)));
    }); 
}

function dsas_display_tasks(what = "all") {
  if (what === "all" || what === "tasks" || what == "status") {
    fetch("api/dsas-task.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(tasks => {
      var i = 0;
      var body = '';
      if (tasks.task) {
        for (task of (tasks.task.constructor === Object ? [tasks.task] : tasks.task)) { 
          cls = (task.last == "never" ? "text-info" : (task.status == "Running" ? "text-info" : (task.status == "Failed" ? "text-danger" : "text-success")));
          body = body +
              '<p class="my-0 ' + cls + '"><a class="text-toggle" data-bs-toggle="collapse" href="#task' + i + '" role="button"' +
              'aria-controls="task' + i + '" aria-expanded="' + (what === "status" ? (document.getElementById("task" + i).className.includes("show") ? "true" : "false" ) : "false") +'">' +
              '<i class="text-collapsed"><img src="caret-right.svg"/></i>' +
              '<i class="text-expanded"><img src="caret-down.svg"/></i></a>' + task.name +
              '&nbsp;<a data-toggle="tooltip" title="' + _("Edit") +'" onclick="dsas_task_modify(\'' + task.id + '\');">' +
              '<img src="pencil-square.svg"></a>';
          body = body + '&nbsp;<a data-toggle="tooltip" title="' + _("Delete") + '" onclick="dsas_task_delete(\'' + task.id +
              '\', \'' + task.name + '\');"><img src="x-lg.svg"></a>';
          body = body + '&nbsp;<a data-toogle="tooltip" title="' + _("Run") + '" onclick="dsas_task_run(\'' + task.id +
              '\', \'' + task.name + '\');"><img src="play.svg" width="20" height="20"></a>';
          body = body + '&nbsp;<a data-toogle="tooltip" title="' + _("Info") + '" onclick="dsas_task_info(\'' + task.id +
              '\', \'' + task.name + '\');"><img src="info.svg"></a>';
          // Keep the tab open if only updating the status
          body = body +
              '</p><div class="' + ( what === "status" ? document.getElementById("task" + i).className : "collapse") + '" id="task' + i + '"><div class="card card-body">' +
              '<pre>' + task_body(task) + '</pre></div></div>\n';
          if (status === "what")
            console.log(document.getElementById("task" + i).class);
          i++;
        }
      }
      document.getElementById("Tasks").innerHTML = body;
      timeout_status = setTimeout(dsas_display_tasks, 10000, "status");
    }).catch(error => {
      fail_loggedin(error.statusText);
    });
  }
}

function print_obj(obj) {
  return (empty_obj(obj) ? "" : _(obj));
}

function empty_obj(obj) {
  if (! obj || Object.keys(obj).length === 0 || obj === "undefined")
    return true;
  else
    return false;
}

function date_to_locale(d){
  if (d == "never")
    return _("never");
  c = new Intl.DateTimeFormat(ml.currentLanguage, {
    year : "numeric",
    month : "short",
    day : "numeric",
    hour : "numeric",
    minute : "numeric",
    second : "numeric"});
  if (typeof(d) === "string") {
    return c.format(new Date(d.substr(0,4) + "-" + d.substr(4,2) + "-" + d.substr(6,2) + "T" + 
           d.substr(8,2) + ":" + d.substr(10,2) + ":" + d.substr(12,2) + "Z"));
  } else {
    var _r = [];
    for (_d of d)
      _r.push(c.format(new Date(_d.substr(0,4) + "-" + _d.substr(4,2) + "-" + _d.substr(6,2) + "T" + 
           _d.substr(8,2) + ":" + _d.substr(10,2) + ":" + _d.substr(12,2) + "Z")));
    return _r;
  }
}

function task_body(task) {
  var body = "";

  body = 
    '<div class="container">' +
    '<div class="row">' +
    '<div class="col-6 overflow-hidden">' +
    '<p class="my-0">' + _("Directory :") + ' ' + print_obj(task.directory) + '</p>' +
    '<p class="my-0">' + _("URI :") + ' ' + print_obj(task.uri) + '</p>' +
    '<p class="my-0">' + _("URI Certification Authority :") + ' ' +
      (empty_obj(task.ca.name) ? _("Base") : print_obj(task.ca.name)) + '</p>' +
    '<p class="my-0">' + _("Task type :") + ' ' + print_obj(task.type) + '</p>' +
    '<p class="my-0">' + _("Periodicity :") + ' ' + print_obj(task.run) + '</p>' +
    '<p class="my-0">' + _("Last :") + ' ' + date_to_locale(task.last) + '</p>' +
    '<p class="my-0">' + _("Status :") + ' ' + print_obj(task.status) + '</p>' +
    '</div>' +
    '<div class="col-6  overflow-hidden">' +
    '<p class="my-1">' + _("Certificates :") + '</p>' +
    '<div class="container p-1 my-1 border overflow-hidden">';

  if (empty_obj(task.cert))
    body = body + '<p class="my-0"></p>';
  else {
    if (task.cert.constructor === Object) {
      body = body + '<p class="my-0">' + task.cert.name + '</p>';
    } else {
      for (cert of task.cert) {
        body = body + '<p class="my-0">' + cert.name + '</p>';
      }
    }
  }
  body = body + '</div></div></div></div>';

  return body;
}

function dsas_task_delete(id, name){
  var body = _("Delete the task ?<br><small>&nbsp;&nbsp;Name : {0}<br>&nbsp;&nbsp;ID : {1}</small>", name, id) +
    '<br><input class="form-check-iput" type="checkbox" id="TaskDeleteFiles" checked>' +
    '<label class="form-check-label" for="TaskDeleteFiles">' + _("Delete task files")  + '</label>';
  modal_action(body, "dsas_task_real_delete('" + id + "');", true);
}

function dsas_task_real_delete(id) {
  var formData = new FormData;
  var deleteFiles = document.getElementById("TaskDeleteFiles").checked;
  document.getElementById("TaskDeleteFiles")
  formData.append("op", "delete");
  formData.append("id", id);
  formData.append("delete", deleteFiles);
  fetch("api/dsas-task.php", {method: "POST", body: formData 
    }).then( response => {
      if (response.ok) 
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(text => {
      try {
        const errors = JSON.parse(text);
        modal_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok"
        clear_feedback();
        dsas_display_tasks("tasks");
      }
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error : {0}", (error.statusText ? error.statusText : error)));
    });
}

function dsas_task_new() {
  modal_task();
  document.getElementById('TaskName').value = "";
  document.getElementById('TaskDirectory').value = "";
  document.getElementById('TaskURI').value = "";

  for (opt of document.getElementsByTagName("option"))
    if (opt.id === "TaskTypeNull" || opt.id === "TaskRunNull" || opt.id === "TaskAddCert0" || opt.id === "TaskCA_Base")
      opt.selected = true;
    else
      opt.selected = false;
  document.getElementById('TaskCert').innerHTML = "";
}

function dsas_task_modify(id) {
  fetch("api/dsas-task.php").then(response => {
    if (response.ok) 
      return response.json();
    else
      return Promise.reject({status: response.status, 
          statusText: response.statusText});
  }).then(tasks => {
    if (tasks.task) {
      for (task of (tasks.task.constructor === Object ? [tasks.task] : tasks.task)) {
        if (id === task.id) {
          modal_task("dsas_modify_task(task.name, task.id);", task.ca.fingerprint);
          document.getElementById('TaskName').value = print_obj(task.name);
          document.getElementById('TaskDirectory').value = print_obj(task.directory);
          document.getElementById('TaskURI').value = print_obj(task.uri);

          for (opt of document.getElementsByTagName("option")) {
            if (opt.id.substr(0,8) === "TaskType") {
              if (opt.value === task.type)
                opt.selected = true;
              else
                opt.selected = false;
            }
            if (opt.id.substr(0,7) === "TaskRun") {
              if (opt.value === task.run)
                opt.selected = true;
              else
                 opt.selected = false;
            }
            if (opt.id.substr(0,11) === "TaskAddCert") {
              if (opt.id === "TaskAddCert0")
                opt.selected = true;
              else
                opt.selected = false;
            }
          }
          if (task.cert.constructor === Object) {
            document.getElementById('TaskCert').innerHTML =  
              document.getElementById('TaskCert').innerHTML +'<dsas-task-cert name="' + task.cert.name +
              '" fingerprint="' + task.cert.fingerprint + '"></dsas-task-cert>';
          } else {
            for (cert of task.cert) {
              document.getElementById('TaskCert').innerHTML =  
                document.getElementById('TaskCert').innerHTML +'<dsas-task-cert name="' + cert.name +
                '" fingerprint="' + cert.fingerprint + '"></dsas-task-cert>';
            }
          }
          for (inp of document.getElementsByTagName("input")) {
            if (inp.id.substr(0,8) === "TaskArch") {
              inp.disabled = (task.type !== "deb");
              inp.checked = false;
              if (! empty_obj(task.archs)) {
                for (arch of task.archs.arch)
                  if (inp.value === arch)
                    inp.checked = true;
              }
            }
          }
          break;
        }
      }
    }
  }).catch(error => {
    fail_loggedin(error.statusText);
  });
}

function dsas_task_run(id, name){
  modal_action(_("Run the task ?&nbsp;&nbsp;Name : {0}<br>&nbsp;&nbsp;ID : {1}", name, id),
     "dsas_task_real_run('" + id + "');", true);
}

function dsas_task_real_run(id) {
  var formData = new FormData;
  formData.append("op", "run");
  formData.append("id", id);
  fetch("api/dsas-task.php", {method: "POST", body: formData 
    }).then( response => {
      if (response.ok) 
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(text => {
      try {
        const errors = JSON.parse(text);
        modal_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok"
        clear_feedback();
        dsas_display_tasks("status");
      }
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error : {0}", (error.statusText ? error.statusText : error)));
    });
}

function dsas_task_info(id, name) {
  var formData = new FormData;
  formData.append("op", "info");
  formData.append("id", id);
  fetch("api/dsas-task.php", {method: "POST", body: formData 
    }).then( response => {
      if (response.ok) 
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(text => {
      info = JSON.parse(text);
      modal_info(name, info[0]["info"]);
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error : {0}", (error.statusText ? error.statusText : error)));
    });
}

function dsas_add_task_arch() {
  var type = "";
  for (opt of document.getElementsByTagName("option"))
    if (opt.id.substr(0,8) === "TaskType" && opt.selected)
      type = opt.value;

  for (inp of document.getElementsByTagName("input")){
    if (inp.substr(0,8) === "TaskArch") {
      if (type === "deb")
        inp.disabled = false;
      else
        inp.disabled = true;
    }
  }
}

function dsas_add_task_cert() {
  var taskCert = document.getElementById("TaskCert");
  var name = "";
  var finger = "";
  for (opt of document.getElementsByTagName("option")) {
    if (opt.id.substr(0,7) === "TaskRun" || opt.id.substr(0,8) === "TaskType" || opt.id.substr(0,6) === "TaskCA")
      continue;
    if (opt.selected) {
      name = opt.innerHTML
      finger = opt.value;
      break;
    }
  }
  if (finger && name) {
    add = true;
    for (line of document.getElementsByTagName("dsas-task-cert")) {
      if(line.getAttribute("fingerprint") == finger) {
        add = false;
        break;
      }
    }
    if (add)
      taskCert.innerHTML =  taskCert.innerHTML +'<dsas-task-cert name="' + name +
          '" fingerprint="' + finger + '"></dsas-task-cert>';
  }
}

function dsas_task_cert_delete(fingerprint){
  var body = "";
  for (line of document.getElementsByTagName("dsas-task-cert")) {
    if(line.getAttribute("fingerprint") != fingerprint) {
      body = body + '<dsas-task-cert name="' +  line.getAttribute("name") +
      '" fingerprint="' + line.getAttribute("fingerprint") + '"></dsas-task-cert>';
    }
  }
  document.getElementById("TaskCert").innerHTML = body;
}

function dsas_modify_task(oldname = "", oldid="") {
  var name = document.getElementById("TaskName").value;

  // If the old name is not empty and different than the new name, then we're
  // modifying a task and we've changed the name.
  if (oldname && oldname != name) {
    var formData = new FormData;
    formData.append("op", "name");
    formData.append("data", JSON.stringify({
             old: oldname,
             new: name}));
    fetch("api/dsas-task.php", {method: "POST", body: formData
      }).then( response => {
        if (response.ok)
          dsas_add_task();
        else
          return Promise.reject({status: response.status,
              statusText: response.statusText});
      }).catch(error => {
        if (! fail_loggedin(error.statusText))
          modal_message(_("Error : {0}", (error.statusText ? error.statusText : error)));
      });
  } else
    dsas_add_task();
}

function dsas_add_task() {
  var name = document.getElementById("TaskName").value;
  var directory = document.getElementById("TaskDirectory").value;
  var uri = document.getElementById("TaskURI").value;
  var type = "";
  var run = "";
  var ca = {};
  var certs= [];
  var archs = [];

  for (opt of document.getElementsByTagName("option"))
    if (opt.id.substr(0,8) === "TaskType" && opt.selected)
      type = opt.value;
  for (opt of document.getElementsByTagName("option"))
    if (opt.id.substr(0,7) === "TaskRun" && opt.selected)
      run = opt.value;
  for (opt of document.getElementsByTagName("option"))
    if (opt.id.substr(0,6) === "TaskCA" && opt.selected) {
      if (opt.id === "TaskCA_Base")
        ca = {fingerprint : opt.value, name : "Base"};
      else if (opt.id === "TaskCA_Self")
        ca = {fingerprint : opt.value, name : "Self-Signed"};
      else
        ca = {fingerprint : opt.value, name : opt.innerHTML};
    }
  if (type === "deb") {
    for (inp of document.getElementsByTagName("input")) {
      if (inp.id.substr(0,8) === "TaskArch") {
        archs.push({arch : inp.value, active : inp.checked});
      }
    }
  }
  for (cert of document.getElementsByTagName("dsas-task-cert"))
    certs.push({name : cert.getAttribute("name"), fingerprint: cert.getAttribute("fingerprint")});

  var formData = new FormData;
  formData.append("op", "add");
  formData.append("data", JSON.stringify({
             name: name,
             directory: directory,
             uri: uri,
             type: type,
             run: run,
             ca: ca,
             certs: certs,
             archs : archs}));
  fetch("api/dsas-task.php", {method: "POST", body: formData 
    }).then( response => {
      if (response.ok) 
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(text => {
      try {
        const errors = JSON.parse(text);
        modal_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok"
        clear_feedback();
        dsas_display_tasks("tasks");
      }
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error : {0}", (error.statusText ? error.statusText : error)));
    });
}

function b64toBlob(b64Data, contentType='', sliceSize=512){
  const byteChar = atob(b64Data);
  const byteArray = [];

  for (let offset = 0; offset < byteChar.length; offset += sliceSize) {
    const slice = byteChar.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const ba = new Uint8Array(byteNumbers);
    byteArray.push(ba);
  }

  const blob = new Blob(byteArray, {type: contentType});
  return blob;
}

function dsas_backup(){
  var modalDSAS = document.getElementById("modalDSAS");
  var body = "";
  modal_action(_("Backup the DSAS configuration"), 'dsas_real_backup();', true);
  body = '    <div class="col-9 d-flex justify-content-center">\n' +
         '      <label for="BackupPassword">' + _("Backup password :") + '</label>\n' +
         '      <input type="password" id="BackupPassword" value="" class="form-control" onkeypress="if (event.key === \'Enter\'){ modalDSAS.hide(); dsas_real_backup();}">\n' +
         '    </div>';
  modalDSAS.setAttribute("body", body);
}

function dsas_real_backup(){
  var passwd = document.getElementById("BackupPassword").value;
  var uri = new URL("api/backup.php", window.location.origin);
  uri.search = new URLSearchParams({passwd: passwd});
  fetch(uri).then(response => {
     if (response.ok) 
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(backup => {
      var saveBase64 = (function() {
        var a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        return function (data, name) {
          var backupblob = b64toBlob(data, "application/gzip");
          var backupurl = window.URL.createObjectURL(backupblob);
          a.href = backupurl;
          a.download = name;
          a.click();
          window.URL.revokeObjectURL(backupurl);
        };
      }());
      saveBase64(backup, "dsas_backup.tgz");
    }).catch(error => {
      // Don't translate error.statusText here
      if (! fail_loggedin(error.statusText))
        modal_message(_("Error : {0}", (error.statusText ? error.statusText : error)));
    });     
}

function dsas_restore(){
  var inp = document.createElement("input");
  document.body.appendChild(inp);
  inp.style = "display: none";
  inp.type = "file";
  inp.accept = "application/gzip";
  inp.id = "RestoreSelectFile";
  inp.addEventListener("change", dsas_passwd_restore, true);
  inp.click();
}

function dsas_passwd_restore(){
  var modalDSAS = document.getElementById("modalDSAS");
  var body = "";
  modal_action(_("Restoration of the DSAS configuration"), 'dsas_real_restore();', true);
  body = '    <div class="col-9 d-flex justify-content-center">\n' +
         '      <label for="RestorePassword">' + _("Restoration password :") + '</label>\n' +
         '      <input type="password" id="RestorePassword" value="" class="form-control" onkeypress="if (event.key === \'Enter\') {modalDSAS.hide(); dsas_real_restore();}">\n' +
         '    </div>';
  modalDSAS.setAttribute("body", body);
}

function dsas_real_restore() {
  var passwd = document.getElementById("RestorePassword").value;
  var file = document.getElementById("RestoreSelectFile").files[0];
  var formData = new FormData();
  formData.append("file", file);
  formData.append("passwd", passwd);

  fetch("api/backup.php", {
    method: 'POST',
    body: formData}).then(response => {
      if (response.ok) 
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(text => {
      try {
        const errors = JSON.parse(text);
        modal_errors(errors);
      } catch (e) {
        // Can't apply directly from the restore script as the application
        // might restart the web server. Need to use use apply JS function
        // dsas_apply with a pre setup modal
        var modalDSAS = document.getElementById("modalDSAS");
        modalDSAS.removeAttribute("disable");
        modalDSAS.removeAttribute("body");
        modalDSAS.removeAttribute("size");
        modalDSAS.removeAttribute("hideonclick");
        modalDSAS.setAttribute("action", "");
        modalDSAS.setAttribute("title", _("Apply the configuration"));
        modalDSAS.setAttribute("type", "Ok");
        modalDSAS.show();
        dsas_apply();
      } 
    }).catch(error => {
      if (!fail_loggedin(error.statusText))
        modal_message(_("Error : {0}", (error.statusText ? error.statusText : error)));
    });
}

function dsas_headings(){
  const hs = Array.prototype.slice.call(document.querySelectorAll("h1, h2, h3"));
  const ph = hs.map(h => {
    return {
      title: h.innerText,
      depth: h.nodeName.replace(/\D/g, ""),
      id: h.getAttribute("id")
    }
  }); 
  return ph;
}

function dsas_display_version(){
  document.getElementById("Version").innerHTML = '<p><span data-i18n>DSAS Version</span> : ' + dsas_version + '</p>';
}

function dsas_help_toc(){
  var body = '<ul class="list-unstyled">';
  var lvl = 1;
  var c = 0;
  const ph = dsas_headings();

  while (lvl < ph[0].depth) {
    // Special case. Stupid idiot not starting with h1 !!
    body = body + '<li><a href="#toc_submenu' + c + '" data-bs-toggle="collapse" aria-expanded="false" ' +
      'class="dropdown-toggle dropdown-toggle-split' + (lvl == 1 ? '' : ' ms-2') + '">Main</a>'+
      '<ul class="list-unstyled small collapse" id="toc_submenu' + c++ + '">';
   lvl++;
  }
  for (let i = 0; i < ph.length; i++) {
    var h = ph[i];
    while (lvl-- > h.depth)
      // Close the submenu
      body = body + '</ul></li>';
    lvl = h.depth;
    if (i != (ph.length - 1) && (lvl < ph[i+1].depth)) {
      body = body + '<li' + (lvl == 1 ? '' : ' class="ms-2"') + '><a href="#' + h.id + '">' + h.title + '</a>' +
        '<a href="#toc_submenu' + c + '" data-bs-toggle="collapse" aria-expanded="false" ' +
        'class="dropdown-toggle dropdown-toggle-split"></a>' +
        '<ul class="list-unstyled small collapse" id="toc_submenu' + c++ + '">';
    } else {
      body = body + '<li' + (lvl == 1 ? '' : (lvl == 2 ? ' class="ms-2"' : ' class="ms-4"')) + 
        '><a href="#' + h.id + '">' + h.title + '</a></li>';
    }
  }
  while (lvl-- > 1)
    body = body + '</ul></li>'

  document.getElementById("toc").innerHTML = body + '<ul>';
}

function dsas_display_help(){
  const urlParams = new URLSearchParams(window.location.search);
  const lang = urlParams.get('language');
  var uri = (lang ? "Documentation_" + lang + ".md" : "Documentation_en.md");

  fetch(uri).then(response => {
    if (response.ok) 
      return response.text();
    else
      return Promise.reject({status: response.status, 
          statusText: response.statusText});
  }).then(text => {
    // If user text was passed here we'd need to sanitize it, but the documentation
    // is supplied with the DSAS.  
    document.getElementById("Documentation").innerHTML = '<article class="markdown-body">' + 
        marked(text) + '</article>';
    dsas_help_toc();
  }).catch(error => {
    if (!fail_loggedin(error.statusText))
      modal_message("Erreur pendant le chargement de la documentation : " + error.statusText);
  });
}

function dsas_apply(){
  var modalApply = document.getElementById("modalDSAS")
  modalApply.setAttribute("disable", true);
  modalApply.setAttribute("body", "<span class='spinner-border spinner-border-sm'></span> &nbsp; Sauvegarde de la configuration en cours.");

  fetch("api/save.php").then(response => {
    if (response.ok) 
      return response.text();
    else
      return Promise.reject({status: response.status, 
          statusText: response.statusText});
  }).then(data => {
    modalApply.setAttribute("body", "<span class='spinner-border spinner-border-sm'></span> &nbsp; Application de la configuration en cours.");
    fetch("api/apply.php").then(response => {
      if (response.ok) 
        return response.text();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(data => {
      modalApply.removeAttribute("disable");
      modalApply.removeAttribute("body");  
      modalApply.hide();
      modal_message(_("Configuration applied"));
    }).catch(error => {
      modalApply.removeAttribute("disable");
      modalApply.removeAttribute("body");  
      modalApply.hide();
      modal_message(_("Error during application of the configuration"));
    });
  }).catch(error => {
    modalApply.removeAttribute("disable");
    modalApply.removeAttribute("body");  
    modalApply.hide();
    if (!fail_loggedin(error.statusText))
      modal_message(_("Error during save of the configuration"));
  });
}

function dsas_reboot(){
  var modalReboot = document.getElementById("modalDSAS");
  modalReboot.setAttribute("disable", true);
  modalReboot.setAttribute("body", '  <div class="row">\n'+
                 '    <div class="col-8">\n' +
                 '      <span class="spinner-border spinner-border-sm"></span>&nbsp;' + _("Rebooting the DSAS") +
                 '    </div>' +
                 '    <div class="col-4">' +
                 '      <div class="progress">' +
                 '        <div class="progress-bar" id="progressReboot" role="progressbar" style="" aria-valuenow="" araia-valuemin="0" aria-valuemax="100"></div>' +
                 '      </div>\n' +
                 '    </div>\n' +
                 '  </div>');

  // Clear status and login timeouts before continuing
  if (timeout_login !== 0)
    clearTimeout(timeout_login);
  if (timeout_status !== 0)
    clearTimeout(timeout_status);

  fetch("api/reboot.php").then(response => {
    if (response.ok) 
      setTimeout(waitreboot, 1000);
    else
      return Promise.reject({status: response.status, 
          statusText: response.statusText});
  }).catch( error => {
    modalReboot.removeAttribute("disable");
    modalReboot.hide();
    if (! fail_loggedin(error.statusText))
      modal_message(_("Error during reboot"));
  });
}

function chkdown(site){
  var times = 5;
  var progress = document.getElementById("progressShutdown");

  return new Promise((response, reject) => {
    (function recurse(i) {
      // favicon because its small and Math.random to avoid the cache
      fetch(site + "/favicon.ico?rand=" + Math.random()).then(r => {
        if (times === 30)
          return reject(r);

        setTimeout(() => recurse(++times), 1000);
        var prog = ((times + 5) * 100) / 30;
        progress.setAttribute("style", "width: " + prog + "%");
        progress.setAttribute("aria-valuenow", prog);
      }).catch(err => {
        // Machine is down return success
        response(err);
      });
    })(times);
  });
}

function chkup(site){
  var times = 5;
  var progress = document.getElementById("progressReboot");

  return new Promise((response, reject) => {
    (function recurse(i) {
      // favicon because its small and Math.random to avoid the cache
      fetch(site + "/favicon.ico?rand=" + Math.random()).then(r => {
        // Machine is up. Return success
        response(r);
      }).catch(err => {
         if (times === 30)
          return reject(r);

        setTimeout(() => recurse(++times), 1000);
        var prog = ((times + 5) * 100) / 30;
        progress.setAttribute("style", "width: " + prog + "%");
        progress.setAttribute("aria-valuenow", prog);
      });
    })(times);
  });
}

function waitreboot(counter = 0) {
  var modalReboot = document.getElementById("modalDSAS");
  var progress = document.getElementById("progressReboot");
  counter = counter + 1;

  if (counter < 5) {
    // Wait 5 seconds till testing if up 
    var prog = (counter * 100) / 30;
    progress.setAttribute("style", "width: " + prog + "%");
    progress.setAttribute("aria-valuenow", prog);
    setTimeout(waitreboot, 1000, counter);
  } else {
    chkup(location.host).then(reponse => {
       window.location = "login.html";     
    }).catch(error => {
      modalReboot.removeAttribute("disable");
      modalReboot.hide();  
      modal_message(_("Timeout during restart"));    
    });
  }
}

function dsas_shutdown(){
  var modalShutdown= document.getElementById("modalDSAS");

  modalShutdown.setAttribute("disable", true);
  modalShutdown.setAttribute("body", '  <div class="row">\n'+
                 '    <div class="col-8">\n' +
                 '      <span class="spinner-border spinner-border-sm"></span> &nbsp;' + _("Shutting down the DSAS") +
                 '    </div>' +
                 '    <div class="col-4">' +
                 '      <div class="progress">' +
                 '        <div class="progress-bar" id="progressShutdown" role="progressbar" style="" aria-valuenow="" araia-valuemin="0" aria-valuemax="100"></div>' +
                 '      </div>\n' +
                 '    </div>\n' +
                 '  </div>');

  // Clear status and login timeouts before continuing
  if (timeout_login !== 0)
    clearTimeout(timeout_login);
  if (timeout_status !== 0)
    clearTimeout(timeout_status);

  fetch("api/shutdown.php").then(response => {
    if (response.ok) 
      setTimeout(waitshutdown, 1000);
    else
      return Promise.reject({status: response.status, 
          statusText: response.statusText});
  }).catch( error => {
    modalShutdown.removeAttribute("disable");
    modalShutdown.hide();
    if (! fail_loggedin(error.statusText))
      modal_message(_("Error during shutdown"));
  });
}

function waitshutdown(counter = 0) {
  var modalShutdown= document.getElementById("modalDSAS");
  var progress = document.getElementById("progressShutdown");
  counter = counter + 1;

  if (counter < 5) {
    // Wait 5 seconds till testing if down 
    var prog = (counter * 100) / 30;
    progress.setAttribute("style", "width: " + prog + "%");
    progress.setAttribute("aria-valuenow", prog);
    setTimeout(waitshutdown, 1000, counter);
  } else {
    chkdown(location.host).then(response => {
      modalShutdown.removeAttribute("disable");
      modalShutdown.hide();
      modal_message(_("The DSAS has shutdown. You can close this window"));
    }).catch(error => {
      modalShutdown.removeAttribute("disable");
      modalShutdown.hide();  
      modal_message(_("Timeout during shutdown"));    
    });
  }
}

function dsas_logout(){
  // No error checking because, only possible error is that already logged out
  fetch("api/logout.php").then(response => {
    location.href = "login.html";
  }).catch(error => { location.href = "login.html"; });
}


class multiLang {

  constructor(url, onLoad="", language=""){
    this.phrases = {};
    this.currentLanguage = language;
    this.onLoad = onLoad;

    fetch(url).then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(obj => {
      this.phrases = obj;

      // Is the Language cookie set ?
      let _lang ="";
      if (empty_obj(this.currentLanguage)) {
        var cookieArray = document.cookie.split(';');
        for (let i=0; i < cookieArray.length; i++) {
          let pos = cookieArray[i].indexOf("Language");
          if (pos > -1) {
            _lang = cookieArray[i].substr(10);
            for (let lang of Object.keys(this.phrases)) {
              if (lang === _lang) {
                this.currentLanguage = _lang;
                break;
              }
            } 
          }
        }
      }

      if (empty_obj(this.currentLanguage)) {
        // The language cookie is not set. Detect browser language as the default
        this.currentLanguage = Object.keys(this.phrases)[0];
        let _default = (window.navigator.language || window.navigator.userLanguage)
        for (let lang of Object.keys(this.phrases)) {
          if (lang === _default) {
            this.currentLanguage = lang;
           break;
          } 
        }
      }

      // Set the cookie with the current language if not already in the cookie
      if (_lang !== this.currentLanguage)
        document.cookie = "Language=" + this.currentLanguage + "; expires=Fri 31 Dec 9999 23:59:59;SameSite=Lax";

      // Force reload of heaeder as it might have already been rendered
      for (let _head of document.getElementsByTagName("dsas-header")) 
        _head.render();    

      // Callback after JSON loading
      if (this.onLoad)
        this.onLoad();

    }).catch(error => {
      this.phrases = {};
    });
  }

  setLanguage (_lang){
    for (let lang of Object.keys(this.phrases)) {
      if (lang === _lang) {
        if (this.currentLanguage !== _lang) {
          this.currentLanguage = _lang;
          document.cookie = "Language=" + _lang + "; expires=Fri 31 Dec 9999 23:59:59;SameSite=Lax";
          for (let _head of document.getElementsByTagName("dsas-header")) 
            _head.render();
          if (window.location.pathname === "/help.html") {
            // Special case for help.html
            window.location = "help.html?language=" + this.currentLanguage;
          } else {
            location.reload();
          }
        }
        break;
      } 
    }
  }

  translate (key){
    var str;

    if (this.phrases[this.currentLanguage])
      str = this.phrases[this.currentLanguage][key]

    return (str || key)
  }
}

// Modify the prototype of String to allow formatting
if (!String.format) {
  String.format = function(format) {
    var args = Array.prototype.slice.call(arguments, 1);
    return format.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] != 'undefined' ? args[number] : match;
    });
  };
}

// Global ml variable for the translation. Use "translate" callback to force
// translation of the page with the "translate" function below. Only elements
// with the "data-i18n" property are translated.
var ml = new multiLang("languages.json", translate);

// Use "_" as the function name here to be like in python i8n
function _ (key, ...args) {
  if (empty_obj(key))
    return key;
  else if (typeof(key) === "string") {
    if (empty_obj(args))
      return ml.translate(key);
    else
      return String.format(ml.translate(key), ...args);
  } else {
    key[0] = ml.translate(key[0]);
    if (empty_obj(args))
      return String.format(...key);
    else
      return String.format(...key, ...args);
  }
}

function translate(){
  for (let el of document.querySelectorAll("[data-i18n]")) 
     if (el.innerHTML)
       el.innerHTML = _(el.innerHTML);
  for (let el of document.querySelectorAll("[data-i18n-value]")) 
     if (el.value)
       el.value = _(el.value);
  for (let el of document.querySelectorAll("[data-i18n-title]")) 
     if (el.title)
       el.title = _(el.title);

  // Insert language navbar dropdown
  for (let el of  document.querySelectorAll("[data-i18n-navbar-lang]")) {
    var langs = "";

    for (let lang of Object.keys(ml.phrases))
      langs = langs + '          <a class="dropdown-item" onclick="ml.setLanguage(\'' + 
              lang + '\');">' + lang + '</a>\n';

    el.innerHTML = '      <li class="nav-item dropdown">\n' +
                   '        <a class="nav-link dropdown-toggle" data-bs-toggle="dropdown">' + ml.currentLanguage + '</a>\n' +
                   '        <div class="dropdown-menu">\n' + langs + '        </div>\n' +
                   '      </li>\n';
  }
}

class DSASDisplayLogs {
  constructor(id, logs, all = true, hidescrollbar = false){
    this.holder = document.getElementById(id);
    this.view = null;
    this.logs = logs;
    this.all = all;
    this.tab = 0;
    this.height = this.itemHeight();
    this.hidescrollbar = hidescrollbar;
    this.highlight = {tab: -1, line: -1};

    var div = '<div id="heightForcer"></div>';
    if (this.logs.length)
      for (let i = 0; i < logs.length; i++)
        div = div + '<div id="log' + i + '" class="container tab-pane ' + (i === 0 ? 'active' : 'fade') + '"></div>';
    this.holder.innerHTML = div;
    this.refreshWindow();
    document.getElementById("heightForcer").style.height = (this.numberOfItems() * this.height) + "px";
    if (hidescrollbar)
      // work around for non chrome browsers, hides the scrollbar
      this.holder.style.width = (this.holder.offsetWidth * 2 - this.view.offsetWidth) + 'px';

    if (this.holder.addEventListener) {
      this.holder.addEventListener("scroll", this.delayingHandler.bind(this), false);
      if (this.logs.length > 1) 
        for (var i = 0; i < logs.length; i++)
          document.getElementById("navlog" + i).addEventListener("click", this.changeTab.bind(this), false);
    } else {
      this.holder.attachEvent("onscroll", this.delayingHandler.bind(this));
      if (this.logs.length > 1) 
        for (var i = 0; i < logs.length; i++)
          document.getElementById("navlog" + i).attachEvent("click", this.changeTab.bind(this));
    }
  }

  delayingHandler() {
    setTimeout(this.refreshWindow.bind(this), 10);
  }

  changeTab(e) {
    var tab = parseInt(e.target.id.substr(6));
    if (tab > this.logs.length - 1)
      tab = this.logs.length - 1;
    if (tab < 0)
      tab = 0;
    this.tab = tab
    this.refreshWindow();
    document.getElementById("heightForcer").style.height = (this.numberOfItems() * this.height) + "px";
    if (this.hidescrollbar)
      // work around for non chrome browsers, hides the scrollbar
      this.holder.style.width = (this.holder.offsetWidth * 2 - this.view.offsetWidth) + 'px';
  }

  changeAll(all) {
    this.all = all;
    this.refreshWindow();
    document.getElementById("heightForcer").style.height = (this.numberOfItems() * this.height) + "px";
    if (this.hidescrollbar)
      // work around for non chrome browsers, hides the scrollbar
      this.holder.style.width = (this.holder.offsetWidth * 2 - this.view.offsetWidth) + 'px';
  }

  itemHeight () {
    var pre = document.createElement('pre');
    pre.innerHTML = "testing height";
    this.holder.appendChild(pre)

    var output = pre.offsetHeight;
    this.holder.removeChild(pre)
    return output;
  }

  numberOfItems(){
    var output = 0;
    if (this.logs.length === 0)
      output = 0;
    else {
      if (this.all)
        output = this.logs[this.tab].length
      else {
        for (var index = 0; index < this.logs[this.tab].length; ++index) {
          if (this.logs[this.tab][index]["type"] !== "normal")
            output++;
        }
      }
    }
    return output;
  }

  search(str="") {
    if (str !== "") {
      var curIndex = (this.highlight["line"] < 0 ? this.curItem : this.highlight["line"]);
      var curTab = (this.highlight["tab"] < 0 ? this.tab : this.highlight["tab"]);
      if ((! this.all) && (this.highlight["tab"] < 0)) {
        var line = 0;
        for (var index = 0; index < this.logs[this.tab].length; ++index) {
         if (line === curIndex) {
             curIndex = index;
            break;
          }
          if (this.logs[this.tab][index]["type"] !== "normal")
            line++;
        }
      }
      var matches = [];
      var nmatches = 0;
      var found = -1;
      for (var i = 0; i < this.logs.length; i++) {
        for (var j = 0; j < this.logs[i].length; j++) {
           if (this.logs[i][j]["line"].includes(str)) {
             matches.push({tab : i, line: j});
             if ((found < 0) && ((i > curTab) || ((i === curTab) && (j > curIndex))))
               found = nmatches;
             nmatches++;
           }
        }
      }
      if (found < 0)
        found = 0;
      if (nmatches > 0) {
        // Force all logs to be displayed, as the value we're looking for
        // might be hidden.
        // FIXME : This button text change should not be in this class, 
        // but difficult to put it elsewhere
        this.all = true;
        document.getElementById("loghide").value = _("All logs")

        this.tab = matches[found]["tab"];
        this.highlight = {tab: this.tab, line: matches[found]["line"]};
        if (this.tab !== curTab)
          bootstrap.Tab.getOrCreateInstance(document.querySelector('#navlog' + this.tab)).show();
        this.holder.scrollTop = Math.floor(matches[found]["line"] * this.height);
        this.refreshWindow();
        document.getElementById("heightForcer").style.height = (this.numberOfItems() * this.height) + "px";
        if (this.hidescrollbar)
          // work around for non chrome browsers, hides the scrollbar
          this.holder.style.width = (this.holder.offsetWidth * 2 - this.view.offsetWidth) + 'px';
      }
    }
  }

  refreshWindow () {
    if (this.view != null)
      this.view.remove();    
    if (this.logs.length > 1)
      this.view = document.getElementById('log' + this.tab).appendChild(document.createElement("div"));
    else
      this.view = this.holder.appendChild(document.createElement("div"));

    if (this.logs.length > 0) {
      var firstItem = Math.floor(this.holder.scrollTop / this.height);
      var lastItem = firstItem + Math.ceil(this.holder.offsetHeight / this.height)
      if (lastItem + 1 >= this.logs[this.tab].length)
        lastItem = this.logs[this.tab].length - 1;
      this.view.id = "view";
      this.view.style.top = (firstItem * this.height) + 'px';
      this.view.style.position = "absolute";
      this.curItem = firstItem;

      var pre;
      if (this.all) {
        for (var index = firstItem; index <= lastItem; ++index) {
          pre = document.createElement('pre');
          if ((this.tab == this.highlight["tab"]) && (index === this.highlight["line"])) 
            pre.className = "my-0 bg-info overflow-hidden";
          else if (this.logs[this.tab][index]["type"] === "normal")
            pre.className = "my-0 text-muted overflow-hidden";
          else
            pre.className = "my-0 text-danger overflow-hidden";       
          pre.innerHTML = dsas_verify_line(this.logs[this.tab][index]["line"]); 
          this.view.appendChild(pre);
        }
      } else {
        var line = 0;
        for (var index = 0; index < this.logs[this.tab].length; ++index) {
          if (this.logs[this.tab][index]["type"] !== "normal") {
            if (line >= firstItem) {
              pre = document.createElement('pre');
              pre.className = "my-0 text-danger overflow-hidden";       
              pre.innerHTML = dsas_verify_line(this.logs[this.tab][index]["line"]); 
              view.appendChild(pre);
            }
            line++;
            if (line > lastItem)
              break;
          }
        }
      }
    }
  }
}

class DSASModal extends HTMLElement {
  constructor(){
    super();
  }

  connectedCallback(){
    if (!this.rendered) {
      this.render();
      this.rendered = true;
    }
  }

  render(){
    var tag = this.getAttribute("tag"); 
    var title = this.getAttribute("title"); 
    var body = this.getAttribute("body"); 
    var action = this.getAttribute("action"); 
    var disable = this.getAttribute("disable");
    var type = this.getAttribute("type");
    var hideonclick = this.getAttribute("hideonclick");
    var size = this.getAttribute("size");
    var is_static = this.getAttribute("static");

    this.innerHTML = '        <div class="modal fade" id="static' + tag + '" ' + (is_static === null || is_static === true ? 'data-bs-backdrop="static" data-bs-keyboard="false" ' : '') + 'aria-labelledby="static' + tag + 'Label" aria-hidden="true">\n' +
       '          <div class="modal-dialog' + (size === null || size == '' ? '' : ' modal-' + size) + '">\n' +
       '            <div class="modal-content">\n' +
       '              <div class="modal-header">\n' +
       '                <div id="static' + tag + 'Label">' +  (title === null ? '' : '<h5 class="modal-title">'  + title  + '</h5>') + '</div>\n' +
       '              </div>\n' +
       '              ' + (body === null ? '<div id="body' + tag + '"></div>' : '<div class="modal-body" id="body' + tag + '">' + body + '</div>') + '\n' +
       '              <div class="modal-footer">\n' +
       (type !== "Ok" ? '                <button type="button" id="cancel' + tag  +'" class="btn btn-secondary" data-bs-dismiss="modal"' +
       (disable === null ? '' : ' disable') + '>' + _("Cancel") + '</button>\n' : '') +
       '                <button type="button" id="ok'  + tag + '" class="btn btn-primary"' + 
       ( ! action ? 'data-bs-dismiss="modal"' : 'onclick="' + action + '"' + 
           (hideonclick === null ? '' : ' data-bs-dismiss="modal"')) +
       (disable === null ? '' : ' disable') + '>' + (type === "Ok" ? _("Ok") : _("Confirm")) + '</button>\n' +
       '              </div>\n' +
       '            </div>\n' +
       '          </div>';
   }

  static get observedAttributes() {
    return ["tag", "title", "body", "action", "disable", "type", "hideonclick", "size", "static"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    var tag = this.getAttribute("tag");

    //if ((name !== "body") && (name !== "disable") && (oldValue === null))
    if ((name === "tag") || (name === "type") || (name === "action") || (name === "hideonclick") || (name === "size") || (name === "static"))
      this.render();
    else {
      switch (name) {
        case "disable":
            var type = this.getAttribute("type");
            if (newValue === null) {
              document.getElementById("ok" + tag).removeAttribute("disabled");
              if (type != "Ok") document.getElementById("cancel" + tag).removeAttribute("disabled");            
            } else {
              document.getElementById("ok" + tag).setAttribute("disabled", "");
              if (type != "Ok") document.getElementById("cancel" + tag).setAttribute("disabled", "");
            }
          break;
        case "title": 
           if (document.getElementById("static" + tag + "Label"))
             document.getElementById("static" + tag + "Label").innerHTML = '<h5 class="modal-title">'  + newValue + '</h5>';
           else
             this.render();
          break;
        case "body":
           if (document.getElementById("body" + tag))
             document.getElementById("body" + tag).innerHTML = newValue;
           else
             this.render();
          break;
        default:
          throw "Unknown modal option";
      }
    }
  }

  show() {
    var tag = this.getAttribute("tag");
    var myModal = new bootstrap.Modal(document.getElementById("static" + tag));
    myModal.show();
  }

  hide() {
    // myModal.hide() doesn't seem to work
    var tag = this.getAttribute("tag");
    var type = this.getAttribute("type");
    if (type === "Ok")
      document.getElementById("ok" + tag).click();
    else
      document.getElementById("cancel" + tag).click();
  }
}

customElements.define("dsas-modal", DSASModal);

class DSASHeader extends HTMLElement {
  constructor(){
    super();
  }

  connectedCallback(){
    if (!this.rendered) {
      this.render();
      this.rendered = true;
    }
  }

  render(){
    var disablenav = this.getAttribute("disablenav"); 

    this.innerHTML = '    <div class="row g-0 sticky-top"><div class="col-8"><nav class="navbar navbar-expand-sm bg-dark navbar-dark">\n' +
'      <a class="navbar-brand px-2"' + ((disablenav != "disabled") ? ' href="/' : '') + '">DSAS</a>\n' +
'      <ul class="navbar-nav">\n' +
'      <li class="nav-item dropdown">\n' +
'        <a class="nav-link ' + disablenav + ' dropdown-toggle" data-bs-toggle="dropdown">\n' +
'        ' + _("Configuration") + '\n' +
'        </a>\n' +
'        <div class="dropdown-menu">\n' +
'          <a class="dropdown-item" href="tasks.html">' + _("Tasks") + '</a>\n' +
'          <a class="dropdown-item" href="cert.html">' + _("Certificates") + '</a>\n' +
'          <a class="dropdown-item" href="service.html">' + _("Services") + '</a>\n' +
'          <a class="dropdown-item" href="net.html">' + _("Network") + '</a>\n' +
'          <a class="dropdown-item" href="web.html">' + _("Web") + '</a>\n' +
'        </div>\n' +
'      </li>\n' +
'      <li class="nav-item dropdown">\n' +
'        <a class="nav-link dropdown-toggle" data-bs-toggle="dropdown">\n' +
'        ' + _("System") + '\n' +
'        </a>\n' +
'        <div class="dropdown-menu">\n' +
'          <a class="dropdown-item" href="users.html">' + _("Users") + '</a>\n' +
'          <a class="dropdown-item ' + disablenav + '" onclick="dsas_backup();">' + _("Backup") + '</a>\n' +
'          <a class="dropdown-item" onclick="dsas_restore();">' + _("Restore") + '</a>\n' +
'          <a class="dropdown-item ' + disablenav + '" onclick="modal_action(\'' + _("Are you sure you want to restart ?") + '\', \'dsas_reboot();\')">' + _("Restart") + '</a>\n' + 
'          <a class="dropdown-item ' + disablenav + '" onclick="modal_action(\'' + _("Are you sure you want to shutdown ?") + '\', \'dsas_shutdown();\')">' + _("Shutdown") + '</a>\n' +
'          <a class="dropdown-item ' + disablenav + '" onclick="modal_action(\'' + _("Are you sure you want to logout ?") + '\', \'dsas_logout();\', true)">' + _("Logout") + '</a>\n' +
'        </div>\n' +
'      </li>\n' +
'      <li class="nav-item">\n' +
'        <a class="nav-link ' + disablenav + '" href="help.html' + (ml.currentLanguage ? '?language=' + ml.currentLanguage : '') + '">' + _("Documentation") + '</a>\n' +
'      </li>\n' +
'      </ul>\n' +   
'    </nav></div>' +
'    <div class="col-4"><nav class="navbar navbar-expand-sm bg-dark navbar-dark">\n' +
'      <ul class="navbar-nav ms-auto">\n' +
'      <span data-i18n-navbar-lang></span>\n' +
'      <li class="nav-item px-2">\n' +
'        <a class="nav-link ' + disablenav + ' btn btn-sm btn-danger" onclick="modal_action(\'' + _("Are you sure you want to apply ?") + '\', \'dsas_apply();\')">' + _("Apply") + '</a>\n' +
'      </li>\n' +
'      </ul>\n' +   
'    </nav></div></div>' +
'    <dsas-modal id="modalDSAS" tag="DSAS"  type="Ok"></dsas-modal>\n';

  }

  static get observedAttributes() {
    return ["disablenav"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.render();
  }
}

customElements.define("dsas-header", DSASHeader);

class DSASUser extends HTMLElement {
  constructor(){
    super();
  }

  connectedCallback(){
    if (!this.rendered) {
      this.render();
      this.rendered = true;
    }
  }

  render(){
    var user = this.getAttribute("user");
    var label = this.getAttribute("label");
    var feedback = this.getAttribute("feedback");
    var old = this.getAttribute("old");
    var key = (old === null ? user : old)
    this.innerHTML = '<div class="form-group">\n' +
           '  <label>' + (label ? label : user) + ' :</label>\n' +
           '  <input type="password" id="inp_' + key + '" class="form-control' + 
           (feedback ? ' is-invalid' : '') + '">\n' +
           '  <div id="feed_' + key + '" class="invalid-feedback">' + feedback + '</div>\n' +
           '</div>';
  }

  static get observedAttributes() {
    return ["user", "feedback", "label", "old"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.render();
  }
}

customElements.define("dsas-user", DSASUser);

class DSASTaskCert extends HTMLElement {
  constructor(){
    super();
  }

  connectedCallback(){
    if (!this.rendered) {
      this.render();
      this.rendered = true;
    }
  }

  render(){
    var name = this.getAttribute("name");
    var fingerprint = this.getAttribute("fingerprint");
    this.innerHTML = '<p class="my-0">' + name + '<a  data-toggle="tooltip" title="Supprimer" onclick="dsas_task_cert_delete(\'' + fingerprint + '\',\'' + 
           fingerprint + '\');"><img src="x-lg.svg"></a></p>';
  }

  static get observedAttributes() {
    return ["name", "fingerprint"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.render();
  }

}


customElements.define("dsas-task-cert", DSASTaskCert);
