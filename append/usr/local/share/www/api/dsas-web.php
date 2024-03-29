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

// If the certificates are ever moved from _DSAS_VAR, this code will need to be changed

if (! dsas_loggedin())
  header("HTTP/1.0 403 Forbidden");
else if($_SERVER["REQUEST_METHOD"] == "POST"){
  $errors = array();

  try {
   $dsas = simplexml_load_file(_DSAS_XML);
   if (! $dsas)
     throw new RuntimeException("Error loading XML file");
  
    switch ($_POST["op"]){
      case "renew":
        $options = array(
          "countryName" => htmlspecialchars(trim($_POST["countryName"])),
          "stateOrProvinceName" => htmlspecialchars(trim($_POST["stateOrProvinceName"])),
          "localityName" => htmlspecialchars(trim($_POST["localityName"])),
          "organizationName" => htmlspecialchars(trim($_POST["organizationName"])),
          "organizationalUnitName" => htmlspecialchars(trim($_POST["organizationalUnitName"])),
          "commonName" => htmlspecialchars(trim($_POST["commonName"])),
          "emailAddress" => htmlspecialchars(trim($_POST["emailAddress"])),
        );
        $validity = intval($_POST["validity"]);
        $validity = ($validity < 1 ? 1 : ($validity > 5 ? 5 : $validity)); 
        $days = $validity * 365;
        $validity = (string)$validity; // convert to string

        foreach (array('countryName', 'stateOrProvinceName', 'localityName',
                   'organizationName', 'organizationalUnitName', 'commonName',
                   'commonName', 'emailAddress') as $key) {
          $dsas->config->web->ssl->$key = $options[$key];
        }
        $dsas->config->web->ssl->validity = $validity;

        $out = renew_web_cert($options, $days);
        $csr = $out["csr"];
        $cert = $out["pub"];
        $priv = $out["priv"];

        if (empty($csr) || empty($cert) || empty($priv))
          $errors[] =  ["renew" => "Error during the generation of the certificates"];
        else {
          $retval = file_put_contents(_DSAS_VAR . "/dsas.csr", $csr);
          chmod (_DSAS_VAR . "/dsas.csr", 0640);
          chgrp (_DSAS_VAR . "/dsas.csr", "repo");
          if ($retval !== 0 && $retval !== false) $retval = file_put_contents(_DSAS_VAR . "/dsas_pub.pem", $cert);
          chmod (_DSAS_VAR . "/dsas_pub.pem", 0640);
          chgrp (_DSAS_VAR . "/dsas.csr", "repo");
          if ($retval !== 0 && $retval !== false) $retval = file_put_contents(_DSAS_VAR . "/dsas_priv.pem", $priv);
          chmod (_DSAS_VAR . "/dsas_priv.pem", 0640);
          chgrp (_DSAS_VAR . "/dsas.csr", "repo");
          if ($retval !== 0 && $retval !== false) $retval = file_put_contents(_DSAS_VAR . "/dsas.pem", $priv . PHP_EOL . $cert);
          chmod (_DSAS_VAR . "/dsas.pem", 0640);
          chgrp (_DSAS_VAR . "/dsas.csr", "repo");
          if ($retval === 0 || $retval === false) 
            $errors[] = ["renew" => "Error while saving the certiciates"];  
          else
            $dsas->asXml(_DSAS_XML);
        }
        break;

      case "upload" :
       
        try {
          check_files($_FILES["file"], "text/plain");

          $crt = htmlspecialchars((string)file_get_contents($_FILES["file"]["tmp_name"]));
          $crt = str_replace("\r", "", $crt);   // dos2unix
          if (!openssl_x509_parse($crt))
            throw new RuntimeException("The CRT file must be in PEM format");
          
          $priv = file_get_contents(_DSAS_VAR . "/dsas_priv.pem");
          $retval = file_put_contents(_DSAS_VAR . "/dsas_pub.pem", $crt);
          chmod (_DSAS_VAR . "/dsas_pub.pem", 0600);
          if ($retval !== 0 && $retval !== false) 
            $retval = file_put_contents(_DSAS_VAR . "/dsas.pem", $priv . PHP_EOL . $crt);
          chmod (_DSAS_VAR . "/dsas.pem", 0600);
          if ($retval === 0 || $retval === false) 
            throw new RuntimeException("Error while saving the CRT");

        } catch (RuntimeException $e) {
          $errors[] = ["upload" => $e->getMessage()];
        }
        break;

      default:
        $errors[] = ["error" => ["Unknown operation '{0}' requested", (string)$_POST["op"]]]; 
        break;
    }
  } catch (Exception $e) {
     $errors[] = ["error" => ["Internal server error : {0}", $e->getMessage()]];
  }
 
  if ($errors == [])
    echo "Ok";
  else {
    header("Content-Type: application/json");
    echo json_encode($errors);
  }
} else {
  $dsas = simplexml_load_file(_DSAS_XML);
  if (! $dsas)
    header("HTTP/1.0 500 Internal Server Error");
  else {
    $web = $dsas->config->web;
    $web->ssl->csr = file_get_contents(_DSAS_VAR . "/dsas.csr");
    $web->ssl->pem = file_get_contents(_DSAS_VAR . "/dsas_pub.pem");
    header("Content-Type: application/json");
    echo json_encode($web);
  }
}
  
?>
