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
      case "x509_upload":
        try {
          // PEM files are detected as text/plain
          check_files($_FILES["file"], "text/plain");
      
          $x509 = htmlspecialchars((string)file_get_contents($_FILES["file"]["tmp_name"]));
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
          $pubkey = htmlspecialchars(trim((string)file_get_contents($_FILES["file"]["tmp_name"])));
          $pubkey = str_replace("\r", "", $pubkey);   // dos2unix
          $pubkeynowrap = preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $pubkey);
          if (($pubkey === $pubkeynowrap) || empty($pubkeynowrap))
            throw new RuntimeException("The public key must be in PEM format");
          $pubkeynowrap = (string)preg_replace('/\\s+/', '', $pubkeynowrap);
          $finger = hash("sha256", base64_decode($pubkeynowrap));
          
          foreach ($dsas->certificates->certificate as $certificate) {
            if ($certificate->type == "pubkey") {
              $pem = htmlspecialchars(trim($certificate->pem));
              $pemnowrap = (string)preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $pem);
              $pemnowrap = (string)preg_replace('/\\s+/', '', $pemnowrap);
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

          $gpg = htmlspecialchars((string)file_get_contents($_FILES["file"]["tmp_name"]));
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
            $pemnowrap = (string)preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $pem);
            $pemnowrap = (string)preg_replace('/\\s+/', '', $pemnowrap);
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

      case "drag" :
        $from_finger = $_POST["from"];
        $to_finger = $_POST["to"];
        $from = -1;
        $to = -1;
        $i = 0;
        foreach ($dsas->certificates->certificate as $certificate) {
          if ($certificate->type == "x509") {
            if (openssl_x509_fingerprint(trim($certificate->pem), "sha256") == $from_finger) {
              $from = $i;
            }
            if (openssl_x509_fingerprint(trim($certificate->pem), "sha256") == $to_finger) {
              $to = $i;
            }
          } else if ($certificate->type == "pubkey") {
            $pem = htmlspecialchars(trim($certificate->pem));
            $pemnowrap = (string)preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $pem);
            $pemnowrap = (string)preg_replace('/\\s+/', '', $pemnowrap);
            if (hash("sha256", base64_decode($pemnowrap)) == $from_finger) {
              $from = $i;
            }
            if (hash("sha256", base64_decode($pemnowrap)) == $to_finger) {
              $to = $i;
            }
          } else {
            $cert = parse_gpg(trim($certificate->pem));
            if ($cert["fingerprint"]  == $from_finger) {
              $from = $i;
            }
            if ($cert["fingerprint"]  == $to_finger) {
              $to = $i;
            }
          }
          if ($from !== -1 && $to !== -1) break;
          $i++;
        }

        if ($from == -1) {
          $errors[] = ["error" => "The certificate drag from value is invalid"];
        } else if ($to == -1) {
          $errors[] = ["error" => "The certificate drag to value is invalid"];
        } else {
          $nt =  $dsas->certificates[0]->count();
          if ($from !== $to && $from !== $to + 1) {
            $cert = new SimpleXMLElement($dsas->certificates[0]->certificate[$from]->asXML());
            $cert_to = $dsas->certificates[0]->certificate[$to];
            unset($dsas->certificates->certificate[$from]);
            simplexml_insert_after($cert, $cert_to);
          }
        }
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
        $p = openssl_x509_parse(trim($certificate->pem));
        if ($p !== false) {
          $cert =  utf8ize($p);
          $cert["pem"] = trim($certificate->pem[0]);
          $cert["fingerprint"] = openssl_x509_fingerprint(trim($certificate->pem[0]), "sha256");
          $cert["authority"] = trim($certificate->authority);
          $dsas_x509[] = $cert;
        }
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
        $pemnowrap = (string)preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', (string)$certificate->pem[0]);
        $pemnowrap = (string)preg_replace('/\\s+/', '', $pemnowrap);
        $cert["fingerprint"] = hash("sha256", base64_decode($pemnowrap));
        $dsas_pubkey[] = $cert;
      } 
    }
    header("Content-Type: application/json");
    echo json_encode([["dsas" => ["x509" => $dsas_x509, "pubkey" => $dsas_pubkey, "gpg" => $dsas_gpg], "ca" => $ca]]);
  }
}

?>
