function modal_message(text, action = null, hide = false){
  var modalDone = document.getElementById("modalDone");
  modalDone.removeAttribute("disable");
  modalDone.removeAttribute("body");

  if (hide)
    modalDone.setAttribute("hideonclick", true);
  else
    modalDone.removeAttribute("hideonclick");
 
  if (action) 
    modalDone.setAttribute("action", action);
  else
    modalDone.setAttribute("action", "");
  modalDone.setAttribute("title", text);
  modalDone.show();
}

function modal_action(text, action = null, hide = false){
  var modalAction = document.getElementById("modalAction");
  modalAction.removeAttribute("disable");
  modalAction.removeAttribute("body");

  if (hide)
    modalAction.setAttribute("hideonclick", true);
  else
    modalAction.removeAttribute("hideonclick");
 
  if (action) 
    modalAction.setAttribute("action", action);
  else
    modalAction.setAttribute("action", "");
  modalAction.setAttribute("title", text);
  modalAction.show();
}

function dsas_loggedin(){
  fetch("api/login.php").then(response => {
    if (! response.ok)
      return Promise.reject({status: response.status, 
          statusText: response.statusText});
  }).catch(error => {
    modal_message("Vous n'&ecirc;tes pas connect&eacute;.\nCliquer 'Ok' afin de vous reconnecter",
        "window.location='login.html'");
  });
}

function fail_loggedin(status){
  if (status === "Forbidden") {
    modal_message("Vous n'&ecirc;tes pas connect&eacute;.\nCliquer 'Ok' afin de vous reconnecter",
        "window.location='login.html'");
    return true;
  } else
    return false;
}

function dsas_init_loggedin(){
  fetch("api/login.php").then(reponse => {
    if (reponse.ok)
      window.location = "/";
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
    document.getElementById("feed_user").innerHTML ="Entrer le nom d'utilisateur.";
    return;
  }

  if (! password) {
    document.getElementById("inp_pass").setAttribute("class", "form-control is-invalid");
    document.getElementById("feed_pass").innerHTML = "Entrer le mot de passe.";
    return;
  }

  var formData = new FormData();
  formData.append("username", username);
  formData.append("password", password);
  fetch("api/login.php", {method: "POST", body: formData 
    }).then(response => {
      if (response.ok)
        window.location = "/";
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).catch(error => {
      document.getElementById("inp_user").setAttribute("class", "form-control is-invalid");
      document.getElementById("inp_pass").setAttribute("class", "form-control is-invalid");
      document.getElementById("feed_pass").innerHTML = "Utilisateur ou mot de passe invalide.";
    });
}

function format_space(bytes) {
  // Special case zero
  if (bytes == 0)
    return "0 B";
  else {
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
        '<h5>Machine bas:</h5>' + machine_status(obj.bas);
      if (obj.haut.status == "down")
        body = body + '</div><div class="col-6 container p-3 border text-muted">' +
           '<h5 class="text-danger">Machine haut: INDISPONIBLE</h5>' + machine_status(obj.haut) + '</div></div>';
      else
        body = body + '</div><div class="col-6 container p-3 border">' +
           '<h5>Machine haut:</h5>' + machine_status(obj.haut) + '</div></div>';
      document.getElementById("StatusBar").innerHTML = body;
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message("Erreur (" + error.status + ") pendant la detection des machine :\n" + error.status);
    });
}

function machine_status(obj){
  var p = 100. - (100. * obj.disk_free) / obj.disk_total;
  var disk = '<div class="d-flex justify-content-between">' +
    '<div>Disque : ' + obj.disk + '</div>\n' +
    '<div>' + format_space(obj.disk_total - obj.disk_free) + 
    ' / ' + format_space(obj.disk_total) + '</div></div>' +
    '  <div class="col-12 progress">\n' +
    '    <div class="progress-bar" role="progressbar" style="width: ' + p.toFixed() +
    '%" aria-valuenow="' + p.toFixed() + '" aria-valuemin="0" aria-valuemax="100">' + p.toFixed(1) + ' %</div>\n' +
    '  </div>\n';
  p = (100. * obj.memory_used) / obj.memory_total;
  var memory = '<div class="d-flex justify-content-between">' +
    '<div>M&eacute;moire :</div>\n' +
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
    '<div>Loadavg :</div>\n<div>' + obj.loadavg + '</div></div>' +
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
        var divWarn = document.getElementById("Warnings");
        var warn = "";
        var error = "";
        var body = "";
        for (const line of obj) {
          if (line["type"] === "warn")
            warn = warn + "<p>" + line["msg"];
          else 
            error = error + "<p>" + line["msg"] + "</p>\n";
        }
        if (error) {
          if (disablenav)
            document.getElementsByTagName("dsas-header")[0].setAttribute("disablenav", "disabled")
          body = body + '<div class="alert alert-danger">' + error + '</div>';
        }
        if (warn)
          body = body + '<div class="alert alert-warning">' + warn + '</div>';
        if (body)
          divWarn.innerHTML = body;
      }
    }).catch(error => {
      fail_loggedin(error.statusText);
    });
}

function dsas_togglelogs(all = false){
   var btn = document.getElementById("loghide");
   if (btn.value === "tous les logs")
     btn.value = "que des erreurs";
   else
     btn.value = "tous les logs";
   dsas_display_logs(all);
}

function dsas_display_logs(all = false){
  var preLog = document.getElementById("VerifLogs");
  fetch("api/dsas-verif-logs.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(logs => {
      var showall =  (document.getElementById("loghide").value === "tous les logs");
      var body = "";
      if (logs) {
        if (!all || logs.length == 1) {
          for (const log of logs[0]) {
            if (log["type"] === "normal") {
              if (showall) 
                body = body + '<span class="text-muted">' + log["line"] + "</span>\n";
            } else
              body = body + '<span class="text-danger">' + log["line"] + "</span>\n";
          }
        } else {
          body = body + '<ul class="nav nav-tabs" id="logs" role="tablist">\n';
          for (let i = 0; i < logs.length; i++) 
            body = body + '  <li class="nav-item"><a class="nav-link' + (i === 0 ? ' active' : '') + '" data-bs-toggle="tab" href="#log' + i + '">' + i + '</a></li>\n';
          body = body + '</ul>\n<div class="tab-content overflow-auto" style="height: 500px">';
          for (let i = 0; i < logs.length; i++) {
            body = body + '<div id="log' + i + '" class="container tab-pane ' + (i === 0 ? 'active' : 'fade') + '">';
            for (const log of logs[i]) {
              if (log["type"] === "normal") {
                if (showall) 
                  body = body + '<pre class="my-0 text-muted overflow-hidden">' + log["line"] + "</pre>\n";
              } else
                body = body + '<pre class="my-0 text-danger overflow-hidden">' + log["line"] + "</pre>\n";
            }
            body = body + '</div>';
          }
          body = body + '</div>';
        }
        preLog.innerHTML = body;
      } else
        preLog.innerHTML = '<span class="text-danger">Aucun log rétourné par le DSAS</span>\n';
    }).catch(error => {
      fail_loggedin(error.statusText);
      preLog.innerHTML = '<span class="text-danger">Erreur pendant la chargement des logs du DSAS</span>\n';
    });
}

function dsas_display_passwd(){
  var divPasswd = document.getElementById("Passwords");
  fetch("api/dsas-users.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(obj => {
      users=obj.user;
      if (!users) {
        divPasswd.innerHTML = '<div class="alert alert-danger">Aucun utilisateur trouvé !</div>';
      } else {
        body = '<form>\n<dsas-user user="' + users[0] + '" label="' + users[0] + 
               ' (mot de pass existant)" old="old"></dsas-user>\n'
        for (user of Object.values(users))
           body = body + '<dsas-user user="' + user + '"></dsas-user>\n'
        body = body + '<div class="form-group">\n' +
              '<input type="submit" class="btn btn-primary" value="Modifier les mots de passe"' +
              ' onclick="dsas_set_passwd(); return false;">\n</div>';     
        divPasswd.innerHTML = body;
      }
    }).catch(error => {
      fail_loggedin(error.statusText);
      divPasswd.innerHTML = '<div class="alert alert-danger">Erreur pendant la chargement des utilisateurs !</div>';
    });
}

function dsas_set_passwd(){
  var Users = document.getElementsByTagName("dsas-user");
  var Passwords = document.getElementsByTagName("input");
  var data = [];
  for (let i = 0; i < Users.length; i++) {
    data.push({username:  Users[i].getAttribute("user"),
               password:  Passwords[i].value,
               old: (i === 0)});
  }

  // Clear old invalid feedbacks
  for (feed of document.getElementsByClassName("invalid-feedback")) 
     feed.innerHTML = "";
  for (feed of document.getElementsByClassName("form-control")) 
     feed.setAttribute("class", "form-control");

  var formData = new FormData();
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
        for (err of errors) {
          if (typeof err.old !== "undefined") {
            document.getElementsByClassName("form-control")[0].setAttribute("class", "form-control is-invalid");
            document.getElementsByClassName("invalid-feedback")[0].innerHTML = err.old;
          } else if (typeof err.error !== "undefined") {
            modal_message(err.error);
          } else {
            key = Object.keys(err)[0];
            document.getElementById("inp_" + key).setAttribute("class", "form-control is-invalid");
            document.getElementById("feed_" + key).innerHTML = err[key];
          }
        }
      } catch (e) {
        // Its text => here always just "Ok"
        // Reload page to clear errors 
        modal_message("Les mots de passe ont &eacute;t&eacute; chang&eacute;s.", "window.location='passwd.html'");
      }
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message("Erreur pendant le changement des mots de passe: " + error.statusText);
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
      if (what === "all" || what === "repo") {
        document.getElementById("repolabel").innerHTML = 
           "La publication de la r&eacute;positoire par HTTPS est " +
           (web.repo  === "true" ? "Activ&eacute;" : "D&eacute;sactiv&eacute;") + " :";
        document.getElementById("reposubmit").value = (web.repo === "true"  ? "Desactiver" : "Activer");
      }
      if (what === "all" || what === "cert") {
        var csrblob = new Blob([web.ssl.csr], {type : "application/x-x509-user-cert"});
        var csrurl = window.URL.createObjectURL(csrblob);
        var pemblob = new Blob([web.ssl.pem], {type : "application/x-x509-user-cert"});
        var pemurl = window.URL.createObjectURL(pemblob);

        document.getElementById("csr_body").innerHTML = web.ssl.csr;
        document.getElementById("getcsr").setAttribute("href", csrurl);
        document.getElementById("pem_body").innerHTML = web.ssl.pem;
        document.getElementById("getpem").setAttribute("href", pemurl);
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
      fail_loggedin(error.statusText);
    });
}

function dsas_toggle_repo(){
  fetch("api/dsas-web.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(web => {
      var formData = new FormData;
      formData.append("op", "repo");
      formData.append("repo", (web.repo === "true" ? "false" : "true"));
      fetch("api/dsas-web.php", {method: "POST", body: formData 
        }).finally(() => {
          dsas_display_web("repo");
          dsas_web_errors();
        });
    }).catch(error => {
      fail_loggedin(error.statusText);
    });
}

function dsas_renew_cert(){
    modal_action("&Ecirc;tes-vous s&ucirc;r de vouloir renouveller la certificate ?",
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
            dsas_web_errors(errors);
            dsas_display_web("cert");
          } catch (e) {
            // Its text => here always just "Ok"
            dsas_display_web("cert");
          }
        });
    }).catch(error => {
      fail_loggedin(error.statusText);
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
        dsas_web_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok"
        modal_message("CRT envoy&eacute; avec sucess", "dsas_display_web('cert');", true);
      }
    }).catch(error => {
      if (!fail_loggedin(error.statusText))
        modal_message("Error : " + error.statusText);
    }); 
}

function dsas_web_errors(errors){
  if (errors && errors != "Ok") {
    var body = "";
    for (err of errors)
       body = body + "<p>" + err[Object.keys(err)] + "</p>";
     document.getElementById("WebErrors").innerHTML = '<div class="alert alert-warning">' + body + '</div>';
     return true;
  } else {
     document.getElementById("WebErrors").innerHTML = "";
     return false;
  }
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
       var body = "";
       for (iface2 of ["bas", "haut"]) {
         iface = net[iface2];
         body = body +
            '<p class="my-0"><a class="text-toggle" data-bs-toggle="collapse" href="#iface' + i +
            '" role="button"' + 'aria-controls="iface' + i + '" aria-expanded="false">' +
            '<i class="text-collapsed"><img src="caret-right.svg"/></i>' +
            '<i class="text-expanded"><img src="caret-down.svg"/></i></a>' + iface2;
         body = body + 
            '</p><div class="collapse" id="iface' + i + '"><div class="card card-body">' +
            iface_body(iface, i) + '</div></div>\n';
         i++;
       }
       document.getElementById("IFaces").innerHTML = body;

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
      fail_loggedin(error.statusText);
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
    '        <label class="form-check-label" for="iface_dhcp' + i + '">Utiliser DHCP</label>\n' +
    '      </div>\n' +
    '      <div class="col-12">\n' +
    '        <label for="iface_cidr' + i + '">Adresse IP/Mask (format CIDR)</label>\n' +
    '        <input type="text" id="iface_cidr' + i + '"' + (dhcp ? ' disabled=""' : '') + ' value="' + print_obj(iface.cidr) + '" class="form-control">\n' +
    '        <div class="invalid-feedback" id="feed_iface_cidr' + i + '"></div>\n' +
    '      </div>\n' +
    '      <div class="col-12">\n' +
    '        <label for="iface_gateway' + i + '">Passerelle </label>\n' +
    '        <input type="text" id="iface_gateway' + i + '"' + (dhcp ? ' disabled=""' : '') + ' value="' + print_obj(iface.gateway) + '" class="form-control">\n' +
    '        <div class="invalid-feedback" id="feed_iface_gateway' + i + '"></div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div class="col-6">\n' +
    '    <div class="row">\n' +
    '      <div class="col-12">\n' +
    '        <label for="iface_dns_domain' + i + '">DNS Domain</label>\n' +
    '        <input type="text" id="iface_dns_domain' + i + '"' + (dhcp ? ' disabled=""' : '') + ' value="' + print_obj(iface.dns.domain) + '" class="form-control">\n' +
    '        <div class="invalid-feedback" id="feed_iface_dns_domain' + i + '"></div>\n' +
    '      </div>\n' +
    '      <div class="form-check col-12">\n' +
    '        <label for="iface_nameserver' + i + '">Serveur de nom (DNS) :</label>\n' +
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
              dsas_net_errors(errors);
            } catch (e) {
              // Its text => here always just "Ok"
              dsas_display_net("all");
            }
          }).catch(error => {
            modal_message("Error : " + error.statusText);
          });

      }).catch(error => {
        fail_loggedin(error.statusText);
      });
  }
}

function dsas_net_errors(errors) {
  // Clear old invalid feedbacks
  for (feed of document.getElementsByClassName("invalid-feedback")) 
     feed.innerHTML = "";
  for (feed of document.getElementsByClassName("form-control")) 
     feed.setAttribute("class", "form-control");
  if (errors !== "Ok") {
    body = "";
    for (error of errors) {
      key = Object.keys(error)[0];
      if (key == "error") {
        body = body + "<p>" + err[Object.keys(err)] + "</p>";
      } else {
        document.getElementById(key).setAttribute("class", "form-control is-invalid");
        document.getElementById("feed_" + key).innerHTML = error[key];
      }
      if (body)
        document.getElementById("NetErrors").innerHTML = '<div class="alert alert-warning">' + body + '</div>';
    }
    return true;
  } else {
    return false;
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
  } else {
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

       server = [];
       for (s of document.getElementById("ntp_pool").value.split(/((\r?\n)|(\r\n?))/)) {
         s = (s ? s.trim() : "");
         if (s) {
           server.push(s);
         }
       }
       serv.ntp.server = server;
 
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
             dsas_service_errors(errors);
           } catch (e) {
             // Its text => here always just "Ok"
             dsas_display_service(what);
           }
         }).catch(error => {
           modal_message("Error : " + error.statusText);
         });
     }).catch(error => {
       fail_loggedin(error.statusText);
     });
  }
}

function dsas_service_errors(errors) {
  // Clear old invalid feedbacks
  for (feed of document.getElementsByClassName("invalid-feedback")) 
     feed.innerHTML = "";
  for (feed of document.getElementsByClassName("form-control")) 
     feed.setAttribute("class", "form-control");
  if (errors !== "Ok") {
    body = "";
    for (error of errors) {
      key = Object.keys(error)[0];
      if (key == "error") {
        body = body + "<p>" + err[Object.keys(err)] + "</p>";
      } else {
        document.getElementById(key).setAttribute("class", "form-control is-invalid");
        document.getElementById("feed_" + key).innerHTML = error[key];
      }
      if (body)
        document.getElementById("ServiceErrors").innerHTML = '<div class="alert alert-warning">' + body + '</div>';
    }
    return true;
  } else {
    return false;
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
      if (what === "all" || what === "gpg")
        document.getElementById("gpg").innerHTML = treat_gpg_certs(certs[0].dsas.gpg);
  
    }).catch(error => {
      fail_loggedin(error.statusText);
    });
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
      '<i class="text-expanded"><img src="caret-down.svg"/></i></a>' + name + 
      '&nbsp;<a data-toggle="tooltip" title="T&eacute;l&eacute;charger" href="' + url + '" download="' + name.replace(/ /g,"_") + '.gpg">' + 
      '<img src="save.svg"></a>';
    body = body + '&nbsp;<a data-toggle="tooltip" title="Supprimer" onclick="dsas_cert_delete(\'' + name + '\',\'' + 
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
    return "Toujours";
  else {
  d = new Date(t * 1000);
  return d.toUTCString();
  }
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
      '&nbsp;<a data-toggle="tooltip" title="T&eacute;l&eacute;charger" href="' + url + '" download="' + name.replace(/ /g,"_") + '.crt">' + 
      '<img src="save.svg"></a>';
    if (added)
      body = body + '&nbsp;<a data-toggle="tooltip" title="Supprimer" onclick="dsas_cert_delete(\'' + name + '\',\'' + 
        cert_finger(cert) + '\');"><img src="x-lg.svg"></a>';
    body = body + 
      '</p><div class="collapse" id="' + (added ? 'add' : 'ca') + i + '"><div class="card card-body">' +
      '<pre style="height : 300px">' + cert_body(cert) + '</pre></div></div>\n';
    i++;
  }
  return body;
}

function dsas_cert_delete(name, finger){
  modal_action("Delete le certificate ?<br><small>&nbsp;&nbsp;Name : " + name + "<br>&nbsp;&nbsp;ID : " + finger.substr(0,50) + "...</small>",
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
        dsas_cert_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok"
        dsas_display_cert("cert");
        dsas_display_cert("gpg");
      }
    }).catch(error => {
      modal_message("Error : " + error.statusText);
    });
}

function cert_finger(cert) {
  if (cert.extensions.subjectKeyIdentifier)
    return cert.extensions.subjectKeyIdentifier;
  else
    return "";
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
    return cert.subject.OU
  if (cert.subject.O)
    return cert.subject.O
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

function dsas_upload_cert(type = "x509") {
  var cert = document.getElementById(type + "upload");
  var formData = new FormData();
  formData.append("op", type + "_upload");
  formData.append("file", cert[0].files[0]);

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
        dsas_cert_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok"
        modal_message("Certificate envoy&eacute; avec sucess", "dsas_display_cert();", true);
      }
    }).catch(error => {
      if (!fail_loggedin(error.statusText))
        modal_message("Error : " + error.statusText);
    }); 
}

function dsas_cert_errors(errors){
  if (errors && errors != "Ok") {
    var body = "";
    if (typeof errors === "string" || errors instanceof String)
      body = body + "<p>" + errors + "</p>"
    else
      for (err of errors)
        body = body + "<p>" + err[Object.keys(err)] + "</p>";
     document.getElementById("CertErrors").innerHTML = '<div class="alert alert-warning">' + body + '</div>';
     return true;
  } else {
     document.getElementById("CertErrors").innerHTML = "";
     return false;
  }
}

function dsas_display_tasks(what = "all") {
  if (what === "all" || what === "cert") {
    fetch("api/dsas-cert.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(certs => {
      var taskAddCert = document.getElementById("TaskAddCert");
      var i = 1;
      var body = '<option id="TaskAddCert0" value="" selected>Selectionner une certificate</option>\n';
      for (cert of certs[0].dsas.x509) {
        body = body + '<option id="TaskAddCert' + i + '" value="' + cert_finger(cert) + 
                      '">' + cert_name(cert) + '</option>\n';
        i++;
      }
      for (cert of certs[0].dsas.gpg) {
        body = body + '<option id="TaskAddCert' + i + '" value="' + cert.fingerprint  + 
                      '">' + cert.uid + '</option>\n';
        i++;
      }
      for (cert of certs[0].ca) {
        body = body + '<option id="TaskAddCert' + i + '" value="' + cert_finger(cert) + 
                      '">' + cert_name(cert) + '</option>\n';
        i++;
      }
      taskAddCert.innerHTML = body;
      
    }).catch(error => {
      fail_loggedin(error.statusText);
    });
  }
  if (what === "all" || what === "tasks") {
    fetch("api/dsas-task.php").then(response => {
      if (response.ok) 
        return response.json();
      else
        return Promise.reject({status: response.status, 
            statusText: response.statusText});
    }).then(tasks => {
      var i = 0;
      var body = "";

      if (tasks.task) {
        for (task of (tasks.task.constructor === Object ? [tasks.task] : tasks.task)) { 
          cls = (task.last == "never" ? "text-info" : (task.status != 0 ? "text-danger" : "text-success"));
          body = body + 
              '<p class="my-0 ' + cls + '"><a class="text-toggle" data-bs-toggle="collapse" href="#task' + i + '" role="button"' + 
              'aria-controls="task' + i + '" aria-expanded="false">' +
              '<i class="text-collapsed"><img src="caret-right.svg"/></i>' +
              '<i class="text-expanded"><img src="caret-down.svg"/></i></a>' + task.name +
              '&nbsp;<a data-toggle="tooltip" title="Modifier" onclick="dsas_task_modify(\'' + task.id + '\');">' + 
              '<img src="pencil-square.svg"></a>';
          body = body + '&nbsp;<a data-toggle="tooltip" title="Supprimer" onclick="dsas_task_delete(\'' + task.id + 
              '\', \'' + task.name + '\');"><img src="x-lg.svg"></a>';
          body = body + '&nbsp;<a data-toogle="tooltip" title="Ex&eacute;cuter" onclick="dsas_task_run(\'' + task.id + 
              '\', \'' + task.name + '\');"><img src="play.svg" width="20" height="20"></a>';
          body = body + 
              '</p><div class="collapse" id="task' + i + '"><div class="card card-body">' +
              '<pre>' + task_body(task) + '</pre></div></div>\n';
          i++;
        }
      }
      document.getElementById("Tasks").innerHTML = body;
    }).catch(error => {
      fail_loggedin(error.statusText);
    });
  }
}

function print_obj(obj) {
  return (empty_obj(obj) ? "" : obj);
}

function empty_obj(obj) {
  if (! obj || Object.keys(obj).length === 0 || obj === "undefined")
    return true;
  else
    return false;
}

function date_to_locale(d){
  if (d == "never")
    return "Jamais"
  var l = new Date(d.substr(0,4) + "-" + d.substr(4,2) + "-" + d.substr(6,2) + "T" + d.substr(8,2) + ":" + d.substr(10,2) + ":" + d.substr(12,2) + "Z");
  return l.toString() 
}

function task_body(task) {
  var body = "";

  body = 
    '<div class="container">' +
    '<div class="row">' +
    '<div class="col-6 overflow-hidden">' +
    '<p class="my-0">Directory : ' + print_obj(task.directory) + '</p>' +
    '<p class="my-0">URI : ' + print_obj(task.uri) + '</p>' +
    '<p class="my-0">Type : ' + print_obj(task.type) + '</p>' +
    '<p class="my-0">Run : ' + print_obj(task.run) + '</p>' +
    '<p class="my-0">Last : ' + date_to_locale(task.last) + '</p>' +
    '<p class="my-0">Status : ' + print_obj(task.status) + '</p>' +
    '</div>' +
    '<div class="col-6  overflow-hidden">' +
    '<p class="my-1">Certificates:</p>' +
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
  modal_action("Delete le tache ?<br><small>&nbsp;&nbsp;Nom : " + name + "<br>&nbsp;&nbsp;ID : " + id,
     "dsas_task_real_delete('" + id + "');", true);
}

function dsas_task_real_delete(id) {
  var formData = new FormData;
  formData.append("op", "delete");
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
        dsas_task_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok"
        dsas_display_tasks("tasks");
      }
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message("Error : " + error.statusText);
    });
}

function dsas_task_new() {
  document.getElementById('TaskName').value = "";
  document.getElementById('TaskDirectory').value = "";
  document.getElementById('TaskURI').value = "";

  for (opt of document.getElementsByTagName("option"))
    if (opt.id === "TaskTypeNull" || opt.id === "TaskRunNull" || opt.id === "TaskAddCert0")
      opt.selected = true;
    else
      opt.selected = false;
  document.getElementById('TaskCert').innerHTML = "";
   document.getElementById('modalTask').show()
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
      document.getElementById('TaskCert').innerHTML = "";
      for (task of (tasks.task.constructor === Object ? [tasks.task] : tasks.task)) {
        if (id === task.id) {
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

          document.getElementById('modalTask').show()
          break;
        }
      }
    }
  }).catch(error => {
    fail_loggedin(error.statusText);
  });
}

function dsas_task_run(id, name){
  modal_action("Exécuter le tache ?<br><small>&nbsp;&nbsp;Nom : " + name + "<br>&nbsp;&nbsp;ID : " + id,
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
        dsas_task_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok"
        dsas_display_tasks("tasks");
      }
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message("Error : " + error.statusText);
    });
}

function dsas_add_task_cert() {
  var taskCert = document.getElementById("TaskCert");
  var name = "";
  var finger = "";
  for (opt of document.getElementsByTagName("option")) {
    if (opt.id.substr(0,7) === "TaskRun" || opt.id.substr(0,8) === "TaskType")
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

function dsas_add_task() {
  var name = document.getElementById("TaskName").value;
  var directory = document.getElementById("TaskDirectory").value;
  var uri = document.getElementById("TaskURI").value;
  var type = "";
  var run = "";
  var certs= [];

  for (opt of document.getElementsByTagName("option"))
    if (opt.id.substr(0,8) === "TaskType" && opt.selected)
      type = opt.value;
  for (opt of document.getElementsByTagName("option"))
    if (opt.id.substr(0,7) === "TaskRun" && opt.selected)
      run = opt.value;
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
             certs: certs}));
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
        dsas_task_errors(errors);
      } catch (e) {
        // Its text => here always just "Ok"
        dsas_display_tasks("tasks");
      }
    }).catch(error => {
      if (! fail_loggedin(error.statusText))
        modal_message("Error : " + error.statusText);
    });
}

function dsas_task_errors(errors){
  if (errors && errors != "Ok") {
    var body = "";
    if (typeof errors === "string" || errors instanceof String)
      body = body + "<p>" + errors + "</p>"
    else
      for (err of errors)
        body = body + "<p>" + err[Object.keys(err)] + "</p>";
     document.getElementById("TaskErrors").innerHTML = '<div class="alert alert-warning">' + body + '</div>';
     return true;
  } else {
     document.getElementById("TaskErrors").innerHTML = "";
     return false;
  }
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

function dsas_help_toc(){
  var body = '<ul class="list-unstyled">';
  var lvl = 1;
  var c = 0;
  const ph = dsas_headings();

  while (lvl < ph[0].depth) {
    // Special case. Stupid idiot not starting with h1 !!
    body = body + '<li' + (lvl == 1 ? '' : ' class="ms-3"') + '><a href="#toc_submenu' + c + '" data-bs-toggle="collapse" aria-expanded="false" ' +
      'class="dropdown-toggle dropdown-toggle-split">Main</a>'+
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
      while (lvl < ph[i+1].depth) {
        body = body + '<li' + (lvl == 1 ? '' : ' class="ms-3"') + '><a href="#' + h.id + '">' + h.title + '</a>' +
          '<a href="#toc_submenu' + c + '" data-bs-toggle="collapse" aria-expanded="false" ' +
          'class="dropdown-toggle dropdown-toggle-split"></a>' +
          '<ul class="list-unstyled small collapse" id="toc_submenu' + c++ + '">';
        lvl++;
      }
    } else {
      body = body + '<li' + (lvl == 1 ? '' : (lvl == 2 ? ' class="ms-3"' : ' class="ms-4"')) + 
        '><a href="#' + h.id + '">' + h.title + '</a></li>';
    }
  }
  while (lvl-- > 1)
    body = body + '</ul></li>'

  document.getElementById("toc").innerHTML = body + '<ul>';
}

function dsas_display_help(){
  fetch("Documentation.md").then(response => {
    if (response.ok) 
      return response.text();
    else
      return Promise.reject({status: response.status, 
          statusText: response.statusText});
  }).then(text => {
    // If user text was parsed here we'd need to sanitize it, but le documentation
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
  var modalApply = document.getElementById("modalApply")

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
      modal_message("Configuration appliqu&eacute;e");
    }).catch(error => {
      modalApply.removeAttribute("disable");
      modalApply.removeAttribute("body");  
      modalApply.hide();
      modal_message("Erreur pendant application de la configuration");
    });
  }).catch(error => {
    modalApply.removeAttribute("disable");
    modalApply.removeAttribute("body");  
    modalApply.hide();
    if (!fail_loggedin(error.statusText))
      modal_message("Erreur pendant la sauvegarde de la configuration");
  });
}

function dsas_reboot(){
  var modalReboot = document.getElementById("modalReboot");
  document.getElementById("modalDone").hide();

  modalReboot.setAttribute("disable", true);
  modalReboot.setAttribute("body", '  <div class="row">\n'+
                 '    <div class="col-8">\n' +
                 '      <span class="spinner-border spinner-border-sm"></span> &nbsp; R&eacute;demarrage de DSAS en cours.' +
                 '    </div>' +
                 '    <div class="col-4">' +
                 '      <div class="progress">' +
                 '        <div class="progress-bar" id="progressReboot" role="progressbar" style="" aria-valuenow="" araia-valuemin="0" aria-valuemax="100"></div>' +
                 '      </div>\n' +
                 '    </div>\n' +
                 '  </div>');

  fetch("api/reboot.php").then(response => {
    if (response.ok) 
      setTimeout(waitreboot, 1000);
    else
      return Promise.reject({status: response.status, 
          statusText: response.statusText});
  }).catch( error => {
    if (! fail_loggedin(error.statusText))
      modal_message("Erreur pendant le red&eacute;marrage");
    modalReboot.removeAttribute("disable");
    modalReboot.hide();
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
         console.log(err);
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
  var modalReboot = document.getElementById("modalReboot");
  var progress = document.getElementById("progressReboot");
  counter = counter + 1;

  modalReboot.show();
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
      modal_message("Timeout sur r&eacute;demarrage !");
      modalReboot.removeAttribute("disable");g
      modalReboot.hide();      
    });
  }
}

function dsas_shutdown(){
  var modalShutdown= document.getElementById("modalShutdown");
  document.getElementById("modalDone").hide();

  modalShutdown.setAttribute("disable", true);
  modalShutdown.setAttribute("body", '  <div class="row">\n'+
                 '    <div class="col-8">\n' +
                 '      <span class="spinner-border spinner-border-sm"></span> &nbsp; Arr&ecirc;t de DSAS en cours.' +
                 '    </div>' +
                 '    <div class="col-4">' +
                 '      <div class="progress">' +
                 '        <div class="progress-bar" id="progressShutdown" role="progressbar" style="" aria-valuenow="" araia-valuemin="0" aria-valuemax="100"></div>' +
                 '      </div>\n' +
                 '    </div>\n' +
                 '  </div>');

  fetch("api/shutdown.php").then(response => {
    if (response.ok) 
      setTimeout(waitshutdown, 1000);
    else
      return Promise.reject({status: response.status, 
          statusText: response.statusText});
  }).catch( error => {
    if (! fail_loggedin(error.statusText))
      modal_message("Erreur pendant l'arr&ecirc;t !");
    modalShutdown.removeAttribute("disable");
    modalShutdown.hide();
  });
}

function waitshutdown(counter = 0) {
  var modalShutdown= document.getElementById("modalShutdown");
  var progress = document.getElementById("progressShutdown");
  counter = counter + 1;

  modalReboot.show();
  if (counter < 5) {
    // Wait 5 seconds till testing if down 
    var prog = (counter * 100) / 30;
    progress.setAttribute("style", "width: " + prog + "%");
    progress.setAttribute("aria-valuenow", prog);
    setTimeout(waitshutdown, 1000, counter);
  } else {
    chkdown(location.host).then(response => {
      modal_message("DSAS arr&ecirc;t&eacute;. Vous pouvez fermer cette fenetre !");
      modalShutdown.removeAttribute("disable");
      modalShutdown.hide();
    }).catch(error => {
      modal_message("Timeout sur r&eacute;demarrage !");
      modalShutdown.removeAttribute("disable");
      modalShutdown.hide();      
    });
  }
}

function dsas_logout(){
  // No error checking because, only possible error is that already logged out
  fetch("api/logout.php").then(response => {
    location.href = "login.html";
  }).catch(error => { location.href = "login.html"; });
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

    this.innerHTML = '        <div class="modal fade" id="static' + tag + '" data-bs-backdrop="static" data-bs-keyboard="false" aria-labelledby="static' + tag + 'Label" aria-hidden="true">\n' +
       '          <div class="modal-dialog' + (size === null || size == '' ? '' : ' modal-' + size) + '">\n' +
       '            <div class="modal-content">\n' +
       '              <div class="modal-header">\n' +
       '                <div id="static' + tag + 'Label">' +  (title === null ? '' : '<h5 class="modal-title">'  + title  + '</h5>') + '</div>\n' +
       '              </div>\n' +
       '              ' + (body === null ? '<div id="body' + tag + '"></div>' : '<div class="modal-body" id="body' + tag + '">' + body + '</div>') + '\n' +
       '              <div class="modal-footer">\n' +
       (type !== "Ok" ? '                <button type="button" id="cancel' + tag  +'" class="btn btn-secondary" data-bs-dismiss="modal"' +
       (disable === null ? '' : ' disable') + '>Annuler</button>\n' : '') +
       '                <button type="button" id="ok'  + tag + '" class="btn btn-primary"' + 
       ( ! action ? 'data-bs-dismiss="modal"' : 'onclick="' + action + '"' + 
           (hideonclick === null ? '' : ' data-bs-dismiss="modal"')) +
       (disable === null ? '' : ' disable') + '>' + (type === "Ok" ? 'Ok' : 'Confirmer') + '</button>\n' +
       '              </div>\n' +
       '            </div>\n' +
       '          </div>';
   }

  static get observedAttributes() {
    return ["tag", "title", "body", "action", "disable", "type", "hideonclick", "size"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    var tag = this.getAttribute("tag");

    //if ((name !== "body") && (name !== "disable") && (oldValue === null))
    if ((name === "tag") || (name === "type") || (name === "action") || (name === "hideonclick") || (name === "size"))
      this.render();
    else {
      switch (name) {
        case "disable":
            if (newValue === null) {
              document.getElementById("ok" + tag).removeAttribute("disabled");
              document.getElementById("cancel" + tag).removeAttribute("disabled");            
            } else {
              document.getElementById("ok" + tag).setAttribute("disabled", "");
              document.getElementById("cancel" + tag).setAttribute("disabled", "");
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

    this.innerHTML = '    <nav class="navbar navbar-expand-sm bg-dark navbar-dark sticky-top">\n' +
'      <a class="navbar-brand"' + ((disablenav != "disabled") ? ' href="/' : '') + '">DSAS</a>\n' +
'      <ul class="navbar-nav">\n' +
'      <li class="nav-item dropdown">\n' +
'        <a class="nav-link ' + disablenav + ' dropdown-toggle" data-bs-toggle="dropdown">\n' +
'        Configuration\n' +
'        </a>\n' +
'        <div class="dropdown-menu">\n' +
'          <a class="dropdown-item" href="tasks.html">Taches</a>\n' +
'          <a class="dropdown-item" href="cert.html">Certificates</a>\n' +
'          <a class="dropdown-item" href="service.html">Services</a>\n' +
'          <a class="dropdown-item" href="net.html">Reseau</a>\n' +
'          <a class="dropdown-item" href="web.html">Web</a>\n' +
'        </div>\n' +
'      </li>\n' +
'      <li class="nav-item dropdown">\n' +
'        <a class="nav-link ' + disablenav + ' dropdown-toggle" data-bs-toggle="dropdown">\n' +
'        Syst&egrave;me\n' +
'        </a>\n' +
'        <div class="dropdown-menu">\n' +
'          <a class="dropdown-item" href="passwd.html">Mot de passe</a>\n' +
'          <a class="dropdown-item" data-bs-toggle="modal" data-bs-target="#staticReboot">R&eacute;demarrage</a>\n' +
'          <a class="dropdown-item" data-bs-toggle="modal" data-bs-target="#staticShutdown">Arr&ecirc;ter</a>\n' +
'        </div>\n' +
'      </li>\n' +
'      <li class="nav-item">\n' +
'        <a class="nav-link ' + disablenav + '" data-bs-toggle="modal" data-bs-target="#staticLogout">Logout</a>\n' +
'      </li>\n' +
'      <li class="nav-item">\n' +
'        <a class="nav-link ' + disablenav + '" href="help.html">Documentation</a>\n' +
'      </li>\n' +'      <li class="nav-item">\n' +
'        <a class="nav-link ' + disablenav + ' btn btn-danger" data-bs-toggle="modal" data-bs-target="#staticApply">Appliquer</a>\n' +
'      </li>\n' +
'      </ul>\n' +
'    </nav>' +
'    <dsas-modal id="modalReboot" tag="Reboot" title="&Ecirc;tre-vous s&ucirc;r de vouloir red&eacute;marrer ?"  action="dsas_reboot();"></dsas-modal>\n' +
'    <dsas-modal id="modalShutdown" tag="Shutdown" title="&Ecirc;tre-vous s&ucirc;r de vouloir arr&ecirc;ter ?" action="dsas_shutdown();"></dsas-modal>\n' +
'    <dsas-modal id="modalLogout" tag="Logout" title="&Ecirc;tre-vous s&ucirc;r de vouloir quitter ?" action="dsas_logout();"></dsas-modal>\n' +
'    <dsas-modal id="modalApply" tag="Apply" title="&Ecirc;tre-vous s&ucirc;r de vouloir appliquer ?" action="dsas_apply();"></dsas-modal>\n' +
'    <dsas-modal id="modalAction" tag="Action"></dsas-modal>\n' +
'    <dsas-modal id="modalDone" tag="Done"  type="Ok"></dsas-modal>\n';

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
