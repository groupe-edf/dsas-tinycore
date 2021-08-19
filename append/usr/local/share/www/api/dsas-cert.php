<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else if($_SERVER["REQUEST_METHOD"] == "POST"){
  $dsas = simplexml_load_file(_DSAS_XML);
  $errors = array();

  try {
    switch ($_POST["op"]){
      case "x509_upload":      
        if (!empty($_FILES["file"])) {
           if ((@$_FILES["file"]["type"] != "text/plain" && 
               @$_FILES["file"]["type"] != "application/x-x509-ca-cert" &&
               @$_FILES["file"]["type"] != "application/x-x509-user-cert"))
            $errors[] = ["x509_upload" => "Certificate doit-&ecirc;tre en format PEM"];
          else {   
            $x509 = htmlspecialchars(file_get_contents($_FILES["file"]["tmp_name"]));
            $x509 = str_replace("\r", "", $x509);   // dos2unix
            $parse = openssl_x509_parse($x509);
            if (! $parse)
              $errors[] = ["509_upload" => "Fichier x509 doit-&ecirc;tre en format PEM"];
            else {
              $certok = true;
              foreach ($dsas->certificates->certificate as $certificate) {
                if ($certificate->type == "x509") {
                  $cert =  openssl_x509_parse(trim($certificate->pem));
                  if ($cert["extensions"]["subjectKeyIdentifier"] == $parse["extensions"]["subjectKeyIdentifier"]) {
                    $errors[] = [ "x509_upload" => "Le certificate X509 existe déja"];
                    $certok = false;
                    break;
                  }
                }
              }
              if ($certok) {
		$newcert = $dsas->certificates->addChild("certificate");
                $newcert->type = "x509";
                $newcert->pem = trim($x509);
              }
            }
          }
        } else 
          $errors[] = ["error" => "Aucun fichier envoy&eacute;"]; 
        break;
 
     case "gpg_upload":      
        if (!empty($_FILES["file"])) {
           if ((@$_FILES["file"]["type"] != "text/plain" && 
               @$_FILES["file"]["type"] != "application/octet-stream" &&
               @$_FILES["file"]["type"] != "application/pgp-keys"))
            $errors[] = ["gpg_upload" => "Certificate doit-&ecirc;tre en format PEM"];
          else {   
            $gpg = htmlspecialchars(file_get_contents($_FILES["file"]["tmp_name"]));
            $gpg = str_replace("\r", "", $gpg);   // dos2unix
            $parse = parse_gpg($gpg);
            if (! $parse)
              $errors[] = ["gpg_upload" => "Fichier GPG doit-&ecirc;tre en format PEM"];
            else {
              $certok = true;
              foreach ($dsas->certificates->certificate as $certificate) {
                if ($certificate->type == "gpg") {
                  $cert =  parse_gpg(trim($certificate->pem));
                  if ($cert["fingerprint"] == $parse["fingerprint"]) {
                    $errors[] = [ "gpg_upload" => "Le certificate GPG existe déja"];
                    $certok = false;
                    break;
                  }
                }
              }
              if ($certok) {
		$newcert = $dsas->certificates->addChild("certificate");
                $newcert->type = "gpg";
                $newcert->pem = trim($gpg);
              }
            }
          }
        } else 
          $errors[] = ["error" => "Aucun fichier envoy&eacute;"]; 
        break;

     case "delete":
        $certok = false;
        $i = 0;
        foreach ($dsas->certificates->certificate as $certificate) {
          if ($certificate->type == "x509") {
            $cert =  openssl_x509_parse(trim($certificate->pem));
            if ($cert["extensions"]["subjectKeyIdentifier"] == $_POST["finger"]) {
              unset($dsas->certificates->certificate[$i]);
              $certok = true;
              break;
            }
          } else {
            $cert = parse_gpg(trim($certificate->pem));
            if ($cert["fingerprint"]  == $_POST["finger"]) {
              unset($dsas->certificates->certificate[$i]);
              $certok = true;
              break;
            }
          }
          $i++;
        }
        if (! $certok)
          $errors[] = [ "delete" => "Le certificate X509 n'existe pas"];
        break;

      default:
        $errors[] = ["error" => "Operation '" . $_POST["op"] . "' demand&eacute; inconnu"]; 
        break;
    }
  } catch (Exception $e) {
     $errors[] = ["error" => "Internal server erreur"];
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
  $cafile = dsas_ca_file();
  if ($cafile)
    $ca = parse_x509($cafile);
  else
    $ca = array();
  $dsas_x509 = array();
  $dsas_gpg = array();
  foreach ($dsas->certificates->certificate as $certificate) {
    if ($certificate->type == "x509") {
      $cert =  utf8ize(openssl_x509_parse(trim($certificate->pem)));
      $cert["pem"] = trim($certificate->pem[0]);
      $dsas_x509[] = $cert;
    } else if ($certificate->type == "gpg") {
      $cert = utf8ize(parse_gpg($certificate->pem));
      $cert["pem"] = trim($certificate->pem[0]);
      $dsas_gpg[] = $cert;
    }
  }
  header("Content-Type: application/json");
  echo json_encode([["dsas" => ["x509" => $dsas_x509, "gpg" => $dsas_gpg], "ca" => $ca]]);
}

?>