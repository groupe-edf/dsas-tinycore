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
  $.get("api/login.php").fail(function(error){
    modal_message("Vous n'&ecirc;tes pas connect&eacute;.\nCliquer 'Ok' afin de reconnecter",
        "window.location='login.html'");
  });
}

function fail_loggedin(status){
  if (status === "Forbidden") {
    modal_message("Vous n'&ecirc;tes pas connect&eacute;.\nCliquer 'Ok' afin de reconnecter",
        "window.location='login.html'");
    return true;
  } else
    return false;
}

function dsas_init_loggedin(){
  $.get("api/login.php").done(function(data){
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
    document.getElementById("feed_pass").innerHTML = "Entrer la mot de passe.";
    return;
  }

  $.post("api/login.php",
    {
      username: username,
      password: password
    }).fail(function(xhr, status, error){
      document.getElementById("inp_user").setAttribute("class", "form-control is-invalid");
      document.getElementById("inp_pass").setAttribute("class", "form-control is-invalid");
      document.getElementById("feed_pass").innerHTML = "Utilisateur ou mot de passe invalide.";
    }).done(function(data){
      window.location = "/"
    });
}

function format_space(bytes) {
  symbols = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  exp = Math.floor(Math.log(bytes)/Math.log(1024));
  return (bytes/Math.pow(1024, Math.floor(exp))).toFixed(2)  + " " + symbols[exp];
}

function dsas_status(){
  $.get("api/dsas-status.php").fail(function(xhdr, error, status){
    if (! fail_loggedin(status))
      modal_message( "Erreur pendant la detection de l'espace de disque !");
  }).done(function(obj){
    var body = '<div class="row"><div class="col-6 container p-3 border">' +
      '<h5>Machine bas:</h5>' + machine_status(obj.bas);
    if (obj.haut.status == "down")
      body = body + '</div><div class="col-6 container p-3 border text-muted">' +
         '<h5>Machine haut: INDISPONIBLE</h5>' + machine_status(obj.bas) + '</div></div>';
    else
      body = body + '</div><div class="col-6 container p-3 border">' +
         '<h5>Machine haut:</h5>' + machine_status(obj.bas) + '</div></div>';
    document.getElementById("StatusBar").innerHTML = body;
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
  $.get("api/dsas-users.php").fail(function(xhdr, error, status){
    fail_loggedin(status)
  }).done(function(obj){
    if ((obj.first == "true") && redirect)
      window.location = "/passwd.html";
  });

  $.get("api/dsas-get-warning.php").fail(function(xhdr, error, status){
    fail_loggedin(status)
  }).done(function(obj){
    if (! empty_obj(obj)) {
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
  $.get("api/dsas-verif-logs.php").done(function(logs){
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
  }).fail(function(xhdr, error, status){
      fail_loggedin(status);
      preLog.innerHTML = '<span class="text-danger">Erreur pendant la chargement des logs du DSAS</span>\n';
  });
}

function dsas_display_passwd(){
   var divPasswd = document.getElementById("Passwords");
   $.get("api/dsas-users.php").done(function(obj){
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
  }).fail(function(xhdr, error, status){
    fail_loggedin(status)
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

  $.post("api/dsas-users.php", { users: data }).fail(function(xhr, error, status){
    if (! fail_loggedin(status))
      modal_message("Erreur pendant la changement des mots de passe");
  }).done(function(errors){
    if (errors && errors != "Ok") {
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
    } else
      // Reload page to clear errors 
      modal_message("Les mots de passe ont &eacute;t&eacute; chang&eacute;.", "window.location='passwd.html'");
  });
}

function dsas_display_web(what = "all"){
  $.get("api/dsas-web.php").done(function(web){
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
  }).fail(function(xhdr, error, status){
      fail_loggedin(status);
  });
}

function dsas_toggle_repo(){
  $.get("api/dsas-web.php").done(function(web){
    web.repo = (web.repo === "true" ? "false" : "true");
    $.post("api/dsas-web.php", 
      { op: "repo",
        data: web
      }).always(function(data){
        dsas_display_web("repo");
        dsas_web_errors();
      });
  }).fail(function(xhdr, error, status){
      fail_loggedin(status);
  });
}

function dsas_renew_cert(){
    modal_action("&Ecirc;tes-vous s&ucirc;r de vouloir renouveller la certificate ?",
        "dsas_renew_cert_real();", true);
}

function dsas_renew_cert_real(){
  $.get("api/dsas-web.php").done(function(web){
 
    for (fld of ["countryName", "stateOrProvinceName", "localityName", 
         "organizationName", "organizationalUnitName", "commonName", "emailAddress"])
      web.ssl[fld] = document.getElementById(fld).value;
    for (let i = 0; i <= 5; i++) {
      if (document.getElementById("valid" + i).checked) {
        web.ssl["validity"] = i;
        break;
      }
    }
    $.post("api/dsas-web.php", 
      { op: "renew",
        data: web
    }).done(function(errors){
       dsas_web_errors(errors);
    }).always(function(data){
      dsas_display_web("cert");
    });
  }).fail(function(xhdr, error, status){
   fail_loggedin(status);
  });
}

function dsas_upload_crt() {
  var crt = document.getElementById("crtupload");
  var formData = new FormData();
  formData.append("op", "upload");
  formData.append("file", crt[0].files[0]);
  $.ajax({
      url: "api/dsas-web.php",
      type: "POST",
      data: formData,
      cache: false,
      async: false,
      contentType: false,
      processData: false,
      success: function(errors){
          if (! dsas_web_errors(errors))
            modal_message("CRT envoyé avec sucess", "dsas_display_web('cert');", true);
        },
      error: function(xhdr, error, status){
          if (!fail_loggedin(status))
            modal_message("Error");
        }
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
  $.get("api/dsas-net.php").done(function(net){
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
         if (! empty_obj(iface.dns.naeserver))
           for (ns of (iface.dns.nameserver.constructor === Array ? 
               iface.dns.nameserver : [iface.dns.nameserver]))
             dns_servers = dns_servers + ns + "\n";
         document.getElementById("iface_nameserver" + i).value = dns_servers;
         i++;
       }
     }
  }).fail(function(xhdr, error, status){
      fail_loggedin(status);
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
    $.get("api/dsas-net.php").done(function(net){
       op = "all";
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
       $.post("api/dsas-net.php", 
         { op: op,
           data: net
         }).always(function(errors){
           if (! dsas_net_errors(errors))
             dsas_display_net("all");
         });
     }).fail(function(xhdr, error, status){
       fail_loggedin(status);
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
  $.get("api/dsas-service.php").done(function(serv){
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
  }).fail(function(xhdr, error, status){
      fail_loggedin(status);
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
    $.get("api/dsas-service.php").done(function(serv){
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
    
       $.post("api/dsas-service.php", 
         { op: op,
           data: serv
         }).always(function(errors){
           if (! dsas_service_errors(errors))
             dsas_display_service(what);
         });
     }).fail(function(xhdr, error, status){
       fail_loggedin(status);
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
  $.get("api/dsas-cert.php").done(function(certs){
    if (what === "all" || what === "ca")
      document.getElementById("ca").innerHTML = treat_x509_certs(certs[0].ca);
    if (what === "all" || what === "cert")
      document.getElementById("cert").innerHTML = treat_x509_certs(certs[0].dsas.x509, true);
    if (what === "all" || what === "gpg")
      document.getElementById("gpg").innerHTML = treat_gpg_certs(certs[0].dsas.gpg);
  
  }).fail(function(xhdr, error, status){
      fail_loggedin(status);
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
  $.post("api/dsas-cert.php", 
    { op: "delete",
      finger: finger
  }).done(function(errors){
    dsas_display_cert("all");
    dsas_cert_errors(errors);
  }).fail(function(xhdr, errors, status){
    fail_loggedin(status);
    dsas_cert_errors(status);
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
  $.ajax({
      url: "api/dsas-cert.php",
      type: "POST",
      data: formData,
      cache: false,
      async: false,
      contentType: false,
      processData: false,
      success: function(errors){
          if (! dsas_cert_errors(errors))
            modal_message("Certificate envoyé avec sucess", "dsas_display_cert();", true);
        },
      error: function(xhdr, error, status){
          if (!fail_loggedin(status))
            modal_message("Error");
        }
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
    $.get("api/dsas-cert.php").done(function(certs){
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
      
    }).fail(function(xhdr, error, status){
      fail_loggedin(status);
    });
  }
  if (what === "all" || what === "tasks") {
    $.get("api/dsas-task.php").done(function(tasks){
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
    }).fail(function(xhdr, error, status){
      fail_loggedin(status);
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

  if (task.cert.constructor === Object) {
    body = body + '<p class="my-0">' + task.cert.name + '</p>';
  } else {
    for (cert of task.cert) {
      body = body + '<p class="my-0">' + cert.name + '</p>';
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
  $.post("api/dsas-task.php", 
    { op: "delete",
      data: {id: id}
  }).done(function(errors){
     dsas_task_errors(errors);
  }).always(function(data){
    dsas_display_tasks("tasks");
  }).fail(function(xhdr, error, status){
    fail_loggedin(status);
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

  $.get("api/dsas-task.php").done(function(tasks){
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
  }).fail(function(xhdr, error, status){
    fail_loggedin(status);
  });
}

function dsas_task_run(id, name){
  modal_action("Exécuter le tache ?<br><small>&nbsp;&nbsp;Nom : " + name + "<br>&nbsp;&nbsp;ID : " + id,
     "dsas_task_real_run('" + id + "');", true);
}

function dsas_task_real_run(id) {
  $.post("api/dsas-task.php", 
    { op: "run", data: {id: id}
  }).done(function(errors){
     dsas_task_errors(errors);
  }).always(function(data){
    dsas_display_tasks("tasks");
  }).fail(function(xhdr, error, status){
    fail_loggedin(status);
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

  $.post("api/dsas-task.php", 
    { op: "add",
      data: {name: name,
             directory: directory,
             uri: uri,
             type: type,
             run: run,
             certs: certs}
  }).done(function(errors){
     dsas_task_errors(errors);
  }).always(function(data){
    dsas_display_tasks("tasks");
  }).fail(function(xhdr, error, status){
    fail_loggedin(status);
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

function dsas_apply(){
  var modalApply = document.getElementById("modalApply")

  modalApply.setAttribute("disable", true);
  modalApply.setAttribute("body", "<span class='spinner-border spinner-border-sm'></span> &nbsp; Sauvegarde de la configuration en cours.");

  $.get("api/save.php").done(function(data){
    modalApply.setAttribute("body", "<span class='spinner-border spinner-border-sm'></span> &nbsp; Application de la configuration en cours.");
    $.get("api/apply.php").done(function(data){
      modalApply.removeAttribute("disable");
      modalApply.removeAttribute("body");  
      modalApply.hide();
      modal_message("Configuration appliqu&eacute;");
    }).fail(function(error){
      modalApply.removeAttribute("disable");
      modalApply.removeAttribute("body");  
      modalApply.hide();
      modal_message("Erreur pendant application de la configuration");
    });
  }).fail(function(xhdr, error, status){
    modalApply.removeAttribute("disable");
    modalApply.removeAttribute("body");  
    modalApply.hide();
    if (!fail_loggedin(status))
      modal_message("Erreur pendant la sauvegarde de la configuration");
  });
}

function isReachable (site) {
  try {
    var img = new Image();
    // Load favicon.ico with cache buster
    img.src = site + "/favicon.ico" + "." + (new Date());
    return true;
  } catch (error) {
    return false;
  }
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

  $.get("api/reboot.php").done(function(data){
    setTimeout(waitreboot, 1000);
  }).fail(function(xhdr, error, status){
    if (! fail_loggedin(status))
      modal_message("Erreur pendant la r&eacute;demarrage");
    modalReboot.removeAttribute("disable");
    modalReboot.hide();
  });
}

function waitreboot(counter = 0) {
  var modalReboot = document.getElementById("modalReboot");
  var progress = document.getElementById("progressReboot");
  counter = counter + 1;

  modalReboot.show();
  if (counter < 120) {
    if (counter > 10 && isReachable(location.host)) {
      window.location = "login.html";
    } else {
      var prog = (counter * 100) / 120;
      progress.setAttribute("style", "width: " + prog + "%");
      progress.setAttribute("aria-valuenow", prog);
      setTimeout(waitreboot, 1000, counter);
    }
  } else {
    modal_message("Timeout sur r&eacute;demarrage !");
    modalReboot.removeAttribute("disable");
    modalReboot.hide();
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

  $.get("api/shutdown.php").done(function(data){
    setTimeout(waitshutdown, 1000);
  }).fail(function(xhdr, error, status){
    if (! fail_loggedin(status))
      modal_message("Erreur pendant l'arr&ecirc;t !");
    modalShutdown.removeAttribute("disable");
    modalShutdown.hide();
  });
}

function waitshutdown(counter = 0, wait = 0) {
  var modalShutdown= document.getElementById("modalShutdown");
  var progress = document.getElementById("progressShutdown");
  counter = counter + 1;

  if (counter < 7) {
    var prog = (counter * 100) / 30;
    progress.setAttribute("style", "width: " + prog + "%");
    progress.setAttribute("aria-valuenow", prog);
    if (isReachable(location.host)) {
      setTimeout(waitshutdown, 1000, counter);
    } else {
      // Wait 5 seconds more because web server will shutdown before the rest
      wait = wait + 1;
      if (wait < 5) {
        setTimeout(waitshutdown, 1000, counter, wait);
      } else {
        modal_message("DSAS l'arr&ecirc;t&eacute;. Vous pouvez fermé ce fenetre !");
        modalShutdown.removeAttribute("disable");
        modalShutdown.hide();
      }
    }
  } else {
    modal_message("Timeout sur l'arr&ecirc;t !");
    modalShutdown.removeAttribute("disable");
    modalShutdown.hide();
  }
}

function dsas_logout(){
  // No error checking because, only possible error is that already logged out
  $.get("api/logout.php").always(function(data){
    location.href = "login.html";
  });
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

    this.innerHTML = '    <nav class="navbar navbar-expand-sm bg-dark navbar-dark">\n' +
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
'        <a class="nav-link ' + disablenav + ' btn btn-danger" data-bs-toggle="modal" data-bs-target="#staticApply">Appliquer</a>\n' +
'      </li>\n' +
'      </ul>\n' +
'    </nav>' +
'    <dsas-modal id="modalReboot" tag="Reboot" title="&Ecirc;tre-vous s&ucirc;r de vouloir r&eacute;demarrer ?"  action="dsas_reboot();"></dsas-modal>\n' +
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
    this.innerHTML = '<p class="my-0">' + name + '<a onclick="dsas_task_cert_delete(\'' + fingerprint + '\',\'' + 
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
