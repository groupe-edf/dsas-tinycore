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
        try {
          // PEM files are detected as text/plain
          check_files($_FILES["file"], "text/plain");
      
          $x509 = htmlspecialchars(file_get_contents($_FILES["file"]["tmp_name"]));
          $x509 = str_replace("\r", "", $x509);   // dos2unix
          $parse = openssl_x509_parse($x509);
          if (! $parse)
            throw new RuntimeException("The X509 file must be in PEM format");
          
          foreach ($dsas->certificates->certificate as $certificate) {
            if ($certificate->type == "x509") {
              if (openssl_x509_fingerprint(trim($certificate->pem, "sha256")) == $parse["fingerprint"])
                throw new RuntimeException("The X509 certrificate already exists");
            }
          }
          $newcert = $dsas->certificates->addChild("certificate");
          $newcert->type = "x509";
          $newcert->pem = trim($x509);
          $newcert->authority = (empty($parse["extensions"]["authorityKeyIdentifier"]) || 
            (!empty($parse["extensions"]["subjectKeyIdentifier"]) && str_contains($parse["extensions"]["authorityKeyIdentifier"],
            $parse["extensions"]["subjectKeyIdentifier"])) ? "true" : "false");
          
        } catch (RuntimeException $e) {
          $errors[] = ["x509_upload" => $e->getMessage()];
        }
        break;
 
     case "gpg_upload":
        try {
          check_files($_FILES["file"], "application/pgp-keys");

          $gpg = htmlspecialchars(file_get_contents($_FILES["file"]["tmp_name"]));
          $gpg = str_replace("\r", "", $gpg);   // dos2unix
          $parse = parse_gpg($gpg);
          if (! $parse)
            throw new RuntimeException("The GPG file must be in PEM format" );

          foreach ($dsas->certificates->certificate as $certificate) {
            if ($certificate->type == "gpg") {
              $cert =  parse_gpg(trim($certificate->pem));
              if ($cert["fingerprint"] == $parse["fingerprint"])
                throw new RuntimeException("Le certificate GPG existe déja");
            }
          }
          $newcert = $dsas->certificates->addChild("certificate");
          $newcert->type = "gpg";
          $newcert->pem = trim($gpg);
          $newcert->authority = "true";
        } catch (RuntimeException $e) {
          $errors[] = ["gpg_upload" => $e->getMessage()];
        }
        break;

     case "delete":
        $certok = false;
        $i = 0;
        foreach ($dsas->certificates->certificate as $certificate) {
          if ($certificate->type == "x509") {
            if (openssl_x509_fingerprint(trim($certificate->pem), "sha256") == $_POST["finger"]) {
              $certok = true;
              break;
            }
          } else {
            $cert = parse_gpg(trim($certificate->pem));
            if ($cert["fingerprint"]  == $_POST["finger"]) {
              $certok = true;
              break;
            }
          }
          $i++;
        }
        if (! $certok)
          $errors[] = [ "delete" => "The certificate doesn't exist"];
        else {
          foreach ($dsas->tasks->task as $task) {
            foreach ($task->cert as $cert) {
              if ($cert->fingerprint == $_POST["finger"]) {
                $certok = false;
                $errors[] = [ "delete" => "Le certificate est utilisé par le tache '" . $task->name . "'"];
              }
            }
          }
         if ($certok)
             unset($dsas->certificates->certificate[$i]);
        }

        break;

      default:
        $errors[] = ["error" => "Operation '" . $_POST["op"] . "' demand&eacute; inconnu"]; 
        break;
    }
  } catch (Exception $e) {
     $errors[] = ["error" => "Internal server error"];
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
      $cert["fingerprint"] = openssl_x509_fingerprint(trim($certificate->pem[0]), "sha256");
      $cert["authority"] = trim($certificate->authority);
      $dsas_x509[] = $cert;
    } else if ($certificate->type == "gpg") {
      $cert = utf8ize(parse_gpg($certificate->pem));
      $cert["pem"] = trim($certificate->pem[0]);
      $cert["authority"] = trim($certificate->authority);
      $dsas_gpg[] = $cert;
    }
  }
  header("Content-Type: application/json");
  echo json_encode([["dsas" => ["x509" => $dsas_x509, "gpg" => $dsas_gpg], "ca" => $ca]]);
}

?>