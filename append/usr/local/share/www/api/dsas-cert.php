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
          $finger = openssl_x509_fingerprint(trim($x509), "sha256");
          if (! $parse)
            throw new RuntimeException("The X509 file must be in PEM format");
          
          foreach ($dsas->certificates->certificate as $certificate) {
            if ($certificate->type == "x509") {
              if (openssl_x509_fingerprint(trim($certificate->pem), "sha256") == $finger)
                throw new RuntimeException("The X509 certificate already exists");
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
 
     case "pubkey_upload":
        try {
          // PEM files are detected as text/plain
          check_files($_FILES["file"], "text/plain");
          $pubkey = htmlspecialchars(trim(file_get_contents($_FILES["file"]["tmp_name"])));
          $pubkey = str_replace("\r", "", $pubkey);   // dos2unix
          $pubkeynowrap = preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $pubkey);
          if (($pubkey === $pubkeynowrap) || empty($pubkeynowrap))
            throw new RuntimeException("The public key must be in PEM format");
          $pubkeynowrap = preg_replace('/\\s+/', '', $pubkeynowrap);
          $finger = hash("sha256", base64_decode($pubkeynowrap));
          
          foreach ($dsas->certificates->certificate as $certificate) {
            if ($certificate->type == "pubkey") {
              $pem = htmlspecialchars(trim($certificate->pem));
              $pemnowrap = preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $pem);
              $pemnowrap = preg_replace('/\\s+/', '', $pemnowrap);
              if (hash("sha256", base64_decode($pemnowrap)) == $finger)
                throw new RuntimeException("The public key already exists");
            }
          }

          $newcert = $dsas->certificates->addChild("certificate");
          $newcert->type = "pubkey";
          $newcert->name = htmlspecialchars(trim($_POST["name"]));
          $newcert->pem = $pubkey;
          $newcert->authority = "true";
        } catch (RuntimeException $e) {
          $errors[] = ["pubkey_upload" => $e->getMessage()];
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
                throw new RuntimeException("The GPG certificate already exists");
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

          } else if ($certificate->type == "pubkey") {
            $pem = htmlspecialchars(trim($certificate->pem));
            $pemnowrap = preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $pem);
            $pemnowrap = preg_replace('/\\s+/', '', $pemnowrap);
            if (hash("sha256", base64_decode($pemnowrap)) == $_POST["finger"]) {
              $certok = "true";
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
                $errors[] = [ "delete" => ["The certificate is used by the task '{0}'", (string)$task->name]];
              }
            }
          }
         if ($certok)
             unset($dsas->certificates->certificate[$i]);
        }

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
  $cafile = dsas_ca_file();
  if ($cafile)
    $ca = parse_x509($cafile);
  else
    $ca = array();
  $dsas_x509 = array();
  $dsas_gpg = array();
  $dsas_pubkey = array();
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
    } else if ($certificate->type == "pubkey") {
      $cert = array();
      $cert["pem"] = trim($certificate->pem[0]);
      $cert["name"] = trim($certificate->name);
      $cert["authority"] = trim($certificate->authority);
      $pemnowrap = preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $certificate->pem[0]);
      $pemnowrap = preg_replace('/\\s+/', '', $pemnowrap);
      $cert["fingerprint"] = hash("sha256", base64_decode($pemnowrap));
      $dsas_pubkey[] = $cert;
    } 
  }
  header("Content-Type: application/json");
  echo json_encode([["dsas" => ["x509" => $dsas_x509, "pubkey" => $dsas_pubkey, "gpg" => $dsas_gpg], "ca" => $ca]]);
}

?>