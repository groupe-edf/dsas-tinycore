<?php
require_once "common.php";

// If the certificates are ever moved from _DSAS_VAR, this code will need to be changed

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else if($_SERVER["REQUEST_METHOD"] == "POST"){
  $dsas = simplexml_load_file(_DSAS_XML);
  $errors = array();

  try {
    switch ($_POST["op"]){
      case "repo":
        if ($_POST["repo"] != $dsas->config->web->repo)  {
          $dsas->config->web->repo = $_POST["repo"];
          $dsas->asXml(_DSAS_XML);
        }
        break;
 
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
        $validity = trim($validity); // Use trim to convert to string

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
          $errors[] =  ["renew" => "Erreur pendant la generation des certificates"];
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
            $errors[] = ["renew" => "Erreur pendant la sauvegarde des certificates"];  
          else
            $dsas->asXml(_DSAS_XML);
        }
        break;

      case "upload" :
       
        if (!empty($_FILES["file"])) {
          @$temp = explode(".", $_FILES["file"]["name"]);
          if ((@$_FILES["file"]["type"] != "text/plain" && 
               @$_FILES["file"]["type"] != "application/x-x509-ca-cert" &&
               @$_FILES["file"]["type"] != "application/x-x509-user-cert") ||
               (end($temp) != "crt"))
            $errors[] = ["upload" => "Fichier CRT doit-&ecirc;tre en format PEM"];
          else {   
            $crt = htmlspecialchars(file_get_contents($_FILES["file"]["tmp_name"]));
            $crt = str_replace("\r", "", $crt);   // dos2unix
            if (!openssl_x509_parse($crt))
              $errors[] = ["upload" => "Fichier CRT doit-&ecirc;tre en format PEM"];
            else {
              $priv = file_get_contents(_DSAS_VAR . "/dsas_priv.pem");
              $retval = file_put_contents(_DSAS_VAR . "/dsas_pub.pem", $crt);
              chmod (_DSAS_VAR . "/dsas_pub.pem", 0600);
              if ($retval !== 0 && $retval !== false) 
                $retval = file_put_contents(_DSAS_VAR . "/dsas.pem", $priv . PHP_EOL . $crt);
              chmod (_DSAS_VAR . "/dsas.pem", 0600);
              if ($retval === 0 || $retval === false) 
                $errors[] = ["upload" => "Erreur pendant la sauvegarde du CRT"];
            }
          }
        } else 
          $errors[] = ["error" => "Aucun fichier envoy&eacute;"]; 
        break;

      default:
        $errors[] = ["error" => "Operation '" . $_POST["op"] . "' demand&eacute; inconnu"]; 
        break;
    }
  } catch (Exception $e) {
     $error[] = ["error" => "Internal server erreur : " + e];
  }
 
  if ($errors == [])
    echo "Ok";
  else {
    error_log(print_r($errors,true));
    header("Content-Type: application/json");
    echo json_encode($errors);
  }
} else {
  $dsas = simplexml_load_file(_DSAS_XML);
  $web = $dsas->config->web;
  $web->ssl->csr = file_get_contents(_DSAS_VAR . "/dsas.csr");
  $web->ssl->pem = file_get_contents(_DSAS_VAR . "/dsas_pub.pem");
  header("Content-Type: application/json");
  echo json_encode($web);
}
  
?>