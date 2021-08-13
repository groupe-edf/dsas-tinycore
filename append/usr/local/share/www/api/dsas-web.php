<?php
require_once "common.php";

// If the certificates are ever moved this will need to be changed
//$WWW_ROOT = dirname($_SERVER["SCRIPT_FILENAME"],3); 
$WWW_ROOT = _DSAS_ROOT . "/var/dsas";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else if($_SERVER["REQUEST_METHOD"] == "POST"){
  $dsas = simplexml_load_file(_DSAS_XML);
  $errors = array();

  try {
    switch ($_POST["op"]){
      case "repo":
        $data = $_POST["data"];
        if ($data["repo"] != $dsas->config->web->repo)  {
          $dsas->config->web->repo = $data["repo"];
          $dsas->asXml(_DSAS_XML);
        }
        break;
 
      case "renew":
        $data = $_POST["data"];
        $options = array(
          "countryName" => htmlspecialchars(trim($data["ssl"]["countryName"])),
          "stateOrProvinceName" => htmlspecialchars(trim($data["ssl"]["stateOrProvinceName"])),
          "localityName" => htmlspecialchars(trim($data["ssl"]["localityName"])),
          "organizationName" => htmlspecialchars(trim($data["ssl"]["organizationName"])),
          "organizationalUnitName" => htmlspecialchars(trim($data["ssl"]["organizationalUnitName"])),
          "commonName" => htmlspecialchars(trim($data["ssl"]["commonName"])),
          "emailAddress" => htmlspecialchars(trim($data["ssl"]["emailAddress"])),
        );
        $validity = intval($data["ssl"]["validity"]);
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
          $retval = file_put_contents($WWW_ROOT . "/dsas.csr", $csr);
          chmod ($WWW_ROOT . "/dsas.csr", 0640);
          chgrp ($WWW_ROOT . "/dsas.csr", "repo");
          if ($retval !== 0 && $retval !== false) $retval = file_put_contents($WWW_ROOT . "/dsas_pub.pem", $cert);
          chmod ($WWW_ROOT . "/dsas_pub.pem", 0640);
          chgrp ($WWW_ROOT . "/dsas.csr", "repo");
          if ($retval !== 0 && $retval !== false) $retval = file_put_contents($WWW_ROOT . "/dsas_priv.pem", $priv);
          chmod ($WWW_ROOT . "/dsas_priv.pem", 0640);
          chgrp ($WWW_ROOT . "/dsas.csr", "repo");
          if ($retval !== 0 && $retval !== false) $retval = file_put_contents($WWW_ROOT . "/dsas.pem", $priv . PHP_EOL . $cert);
          chmod ($WWW_ROOT . "/dsas.pem", 0640);
          chgrp ($WWW_ROOT . "/dsas.csr", "repo");
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
              $priv = file_get_contents($WWW_ROOT . "/dsas_priv.pem");
              $retval = file_put_contents($WWW_ROOT . "/dsas_pub.pem", $crt);
              chmod ($WWW_ROOT . "/dsas_pub.pem", 0600);
              if ($retval !== 0 && $retval !== false) 
                $retval = file_put_contents($WWW_ROOT . "/dsas.pem", $priv . PHP_EOL . $crt);
              chmod ($WWW_ROOT . "/dsas.pem", 0600);
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
  $web->ssl->csr = file_get_contents($WWW_ROOT . "/dsas.csr");
  $web->ssl->pem = file_get_contents($WWW_ROOT . "/dsas_pub.pem");
  header("Content-Type: application/json");
  echo json_encode($web);
}
  
?>