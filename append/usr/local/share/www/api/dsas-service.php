<?php
/**
 *    DSAS - Tinycore
 *    Copyright (C) 2021-2022  Electricite de France
 *
 *    This program is free software; you can redistribute it and/or modify
 *    it under the terms of the GNU General Public License as published by
 *    the Free Software Foundation; either version 2 of the License, or
 *    (at your option) any later version.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU General Public License for more details.
 *
 *    You should have received a copy of the GNU General Public License along
 *    with this program; if not, write to the Free Software Foundation, Inc.,
 *    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

require_once "common.php";

if (! dsas_loggedin())
  header("HTTP/1.0 403 Forbidden");
else if($_SERVER["REQUEST_METHOD"] == "POST"){
  $errors = array();

  try {
    $dsas = simplexml_load_file(_DSAS_XML);
    if (! $dsas)
      throw new RuntimeException("Error loading XML file");
         
    switch ($_POST["op"]){
      case "all":
        /** @var array{ssh: array{active: string, user_tc: string, 
          *                       user_bas: string, user_haut: string},
          *            radius: array{active: string, server: string, secret: string},
          *            syslog: array{active: string, server: string},
          *            ntp: array{active: string, server: array{string}},
          *            antivirus: array{active: string, uri: string},
          *            web: array{repo: string},
          *            snmp: array{active: string, username: string, password: string,
                                   encrypt: string, passpriv: string, 
                                   privencrypt: string}} $data */
        $data = json_decode($_POST["data"], true);
        // Lines like these stop the users from passing values other than true/false
        $dsas->config->ssh->active = ($data["ssh"]["active"] === "true" ? "true" : "false");

        $user_tc = htmlspecialchars(trim($data["ssh"]["user_tc"]));
        $user_tc_err = "";
        if (! empty($user_tc)) {
          foreach (explode(",",$user_tc) as $inet) {
            if (substr($inet,0,1) === "!")
              $inet = substr($inet,1,strlen($inet)-1); 
            if ($user_tc_err = ip_valid($inet, 0))
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
            if ($user_bas_err = ip_valid($inet, 0))
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
            if ($user_haut_err = ip_valid($inet, 0))
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
            // The ntp[0] is here just to avoid a level 9 PHPStan error
            $dsas->config->ntp[0]->server[] = $server;
        } else
          $errors[] = ["ntp_pool" => $pool_err];

        $dsas->config->antivirus->active = ($data["antivirus"]["active"] === "true" ? "true" : "false");
        $antivirus_uri = htmlspecialchars(trim($data["antivirus"]["uri"]));
        if (! empty($antivirus_uri))
          $antivirus_err = uri_valid($antivirus_uri);
        // Set ClamAV client UUID if empty
        if (empty($dsas->config->antivirus->uuid))
          $dsas->config->antivirus->uuid = sprintf("%04x%04x-%04x-%04x-%04x-%04x%04x%04x",
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000, // 4 MSB contain version 4 number
            mt_rand(0, 0x3fff) | 0x8000, // 2 MSB holds DCE1.1 variant
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
        if (empty($antivirus_err))
          $dsas->config->antivirus->uri = $antivirus_uri;
        else
          $errors[] = ["antivirus_uri" => $antivirus_err];

        $dsas->config->web->repo = ($data["web"]["repo"] === "true" ? "true" : "false");

        $dsas->config->snmp->active = ($data["snmp"]["active"] === "true" ? "true" : "false");
        $snmp_username = htmlspecialchars(trim($data["snmp"]["username"]));
        if (($data["snmp"]["active"] === "true") && empty($snmp_username))
          $errors[] = ["snmp_user" => "Empty SMNP Username"];
        else if (preg_match('/[^A-Za-z0-9]/', $snmp_username))
          $errors[] = ["snmp_user" => ["Username '{0}' is illegal", $snmp_username]];
        else
          $dsas->config->snmp->username = $snmp_username;

        $snmp_password = htmlspecialchars($data["snmp"]["password"]);
        if ($snmp_password != $data["snmp"]["password"])
          $errors[] = ["snmp_pass" => "The SNMP password is illegal"];
        else if ($snmp_password != str_replace("/\s+/", "", $snmp_password))
          $errors[] = ["snmp_pass" => "The SNMP password can not contain white spaces"];
        else if ($dsas->config->snmp->active == "true" && ! complexity_test($snmp_password))
          $errors[] = ["snmp_pass" => "The SNMP password is insufficently complex"];
        else
          $dsas->config->snmp->password = $snmp_password;
        $snmp_encrypt = htmlspecialchars($data["snmp"]["encrypt"]);
        if ($snmp_encrypt !== "MD5" && $snmp_encrypt !== "SHA" 
            && $snmp_encrypt !== "SHA256" && $snmp_encrypt !== "SHA512")
          $errors[] = ["error" => "The SNMP authentification encryption is illegal"];
        else
          $dsas->config->snmp->encrypt = $snmp_encrypt;

        $snmp_passpriv = htmlspecialchars($data["snmp"]["passpriv"]);
        if ($snmp_passpriv != $data["snmp"]["passpriv"])
          $errors[] = ["snmp_passpriv" => "The SNMP password is illegal"];
        else if ($snmp_passpriv != str_replace("/\s+/", "", $snmp_passpriv))
          $errors[] = ["snmp_passpriv" => "The SNMP password can not contain white spaces"];
        else if ($dsas->config->snmp->active == "true" && ! complexity_test($snmp_passpriv))
          $errors[] = ["snmp_passpriv" => "The SNMP password is insufficently complex"];
        else
          $dsas->config->snmp->passpriv = $snmp_passpriv;
        $snmp_privencrypt = htmlspecialchars($data["snmp"]["privencrypt"]);
        if ($snmp_privencrypt !== "DES" && $snmp_privencrypt !== "AES" 
            // These additional non-standard options require that net-snmp is compiled with
            // the --enable-blumenthal-aes 
            // && $snmp_privencrypt !== "AES192" && $snmp_privencrypt !== "AES192C" 
            // && $snmp_privencrypt !== "AES256" && $snmp_privencrypt !== "AES256C"
            )
          $errors[] = ["error" => "The SNMP privacy encryption is illegal"];
        else
          $dsas->config->snmp->privencrypt = $snmp_privencrypt;

        break;

      default:
        $errors[] = ["error" => ["Unknown operation '{0}' requested", (string)$_POST["op"]]]; 
        break;
    }
  } catch (Exception $e) {
     $errors[] = ["error" => ["Internal server error : {0}", $e->getMessage()]];
  }
 
  if ($dsas !== false && $errors == []) {
    echo "Ok";
    $dsas->asXml(_DSAS_XML);    
  } else {
    header("Content-Type: application/json");
    echo json_encode($errors);
  }
} else {
  $dsas = simplexml_load_file(_DSAS_XML);
  if (! $dsas)
    header("HTTP/1.0 500 Internal Server Error");
  else {
    header("Content-Type: application/json");
    echo json_encode($dsas->config);
  }
}

?>
