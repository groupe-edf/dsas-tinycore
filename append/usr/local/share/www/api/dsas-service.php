<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else if($_SERVER["REQUEST_METHOD"] == "POST"){
  $dsas = simplexml_load_file(_DSAS_XML);
  $errors = array();

  try {
    switch ($_POST["op"]){
      case "all":
        $data = json_decode($_POST["data"], true);
        // Lines like these stop the users from passing values other than true/false
        $dsas->config->ssh->active = ($data["ssh"]["active"] === "true" ? "true" : "false");

        $user_tc = htmlspecialchars(trim($data["ssh"]["user_tc"]));
        $user_tc_err = "";
        if (! empty($user_tc)) {
          foreach (explode(",",$user_tc) as $inet) {
            if (substr($inet,0,1) === "!")
              $inet = substr($inet,1,strlen($inet)-1); 
            if ($user_tc_err = ip_valid($inet, false))
              break;
          }
        }
        if (empty($user_tc_err))
          $dsas->config->ssh->user_tc = $user_tc;
        else
          $errors[] = [ "user_tc" => $user_tc_err];

        $user_bas = htmlspecialchars(trim($data["ssh"]["user_bas"]));
        $user_bas_err = "";
        if (! empty($user_bas)) {
          foreach (explode(",",$user_bas) as $inet) {
            if (substr($inet,0,1) === "!")
              $inet = substr($inet,1,strlen($inet)-1); 
            if ($user_bas_err = ip_valid($inet, false))
              break;
          }
        }
        if (empty($user_bas_err))
          $dsas->config->ssh->user_bas = $user_bas;
        else
          $errors[] = [ "user_bas" => $user_bas_err];

        $user_haut = htmlspecialchars(trim($data["ssh"]["user_haut"]));
        $user_haut_err = "";
        if (! empty($user_haut)) {
          foreach (explode(",",$user_haut) as $inet) {
            if (substr($inet,0,1) === "!")
              $inet = substr($inet,1,strlen($inet)-1); 
            if ($user_haut_err = ip_valid($inet, false))
              break;
          }
        }
        if (empty($user_haut_err))
          $dsas->config->ssh->user_haut = $user_haut;
        else
          $errors[] = [ "user_haut" => $user_haut_err];
        $dsas->config->radius->active = ($data["radius"]["active"] === "true" ? "true" : "false");
        $radius_server = htmlspecialchars(trim($data["radius"]["server"]));
        if (! empty($radius_server))
          $radius_server_err = inet_valid($radius_server);
        if (empty($radius_server_err))
          $dsas->config->radius->server = $radius_server;
        else
          $errors[] = ["radius_server" => $radius_server_err];
        $radius_secret = htmlspecialchars(trim($data["radius"]["secret"]));
        # FIXME should we control the complexity of the radius secret ?
        if ($radius_secret == trim($data["radius"]["secret"]))
          $dsas->config->radius->secret = $radius_secret;
        else
          $errors[] = ["radius_secret" => "Illegal radius secret"]; // Avoid XSS at least
        $dsas->config->syslog->active = ($data["syslog"]["active"] === "true" ? "true" : "false");
        $dsas->config->ntp->active = ($data["ntp"]["active"] === "true" ? "true" : "false");

        $syslog_server = htmlspecialchars(trim($data["syslog"]["server"]));
        if (! empty($syslog_server))
          $syslog_err = inet_valid($syslog_server);
        if (empty($syslog_err))
          $dsas->config->syslog->server = $syslog_server;
        else
          $errors[] = ["syslog_server" => $syslog_err];

        foreach ($data["ntp"]["server"] as $server) {
          if (!empty($pool_err = inet_valid($server)))
            break;
        }
        if (empty($pool_err)) {
          unset($dsas->config->ntp->server);
          foreach ($data["ntp"]["server"] as $server)
            $dsas->config->ntp->server[] = $server;
        } else
          $errors[] = ["ntp_pool" => $pool_err];

        $dsas->config->antivirus->active = ($data["antivirus"]["active"] === "true" ? "true" : "false");
        $antivirus_uri = htmlspecialchars(trim($data["antivirus"]["uri"]));
        if (! empty($antivirus_uri))
          $antivirus_err = uri_valid($antivirus_uri);
        if (empty($antivirus_err))
          $dsas->config->antivirus->uri = $antivirus_uri;
        else
          $errors[] = ["antivirus_uri" => $antivirus_err];

        break;

      default:
        $errors[] = ["error" => ["Unknown operation '{0}' requested", (string)$_POST["op"]]]; 
        break;
    }
  } catch (Exception $e) {
     $errors[] = ["error" => ["Internal server error : {0}", $e->getMessage()]];
  }
 
  if ($errors == []) {
    echo "Ok";
    $dsas->asXml(_DSAS_XML);    
  } else {
    header("Content-Type: application/json");
    echo json_encode($errors);
  }
} else {
  $dsas = simplexml_load_file(_DSAS_XML);
  header("Content-Type: application/json");
  echo json_encode($dsas->config);
}

?>