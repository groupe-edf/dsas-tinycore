<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else if($_SERVER["REQUEST_METHOD"] == "POST"){
  $dsas = simplexml_load_file(_DSAS_XML);
  $errors = array();

  try {
    switch ($_POST["op"]){
      case "add":
        $data = json_decode($_POST["data"], true);
        $name = htmlspecialchars($data["name"]);
        if (trim($name) == "")
          $errors[] = ["error" => "Le nom ne peut pas être vide"];
        $directory = htmlspecialchars($data["directory"]);
        if (trim($directory) == "")
          $errors[] = ["error" => "Le directoire ne peut pas être vide"];
        $uri =  htmlspecialchars($data["uri"]);
        $type = $data["type"];
        if ($type !== "rpm" && $type !== "repomd" && $type !== "deb" && $type !== "authenticode" &&
            $type !== "openssl" && $type !== "gpg" && $type !== "liveupdate")
          $errors[] = ["error" => "Le type de la tache est illegale"];
        $run = $data["run"];
        if ($run !== "never" && $run !== "hourly" && $run !== "daily" && $run !== "weekly" && $run !== "monthly")
          $errors[] = ["error" => "Le periode entre les executions de la tache est illegale"];
        $certs = array();
        $have_ca = false;
        foreach ($data["certs"] as $cert) {
          $certok = false;
          $certname = "";
          foreach ($dsas->certificates->certificate as $certificate) {
            if ($certificate->type == "x509") {
              if (openssl_x509_fingerprint(trim($certificate->pem), "sha256") == $cert["fingerprint"]) {
                if ($certificate->authority == "true") {
                  if ($have_ca) {
                    $errors[] = ["error" => "Les taches de type " . $type . 
                                 " ne supporte un seul certificate raçine"];
                    break 2;
                  }
                  $have_ca = true;
                }
                if ($type === "rpm" || $type === "repomd" || $type === "deb" || $type === "gpg") {
                  $errors[] = ["error" => "Les taches de type " . $type . 
                            " ne supporte pas des certificates X509"];
                  break 2;
                }

                $certok = true;
                $x509_cert = openssl_x509_parse(trim($certificate->pem));
                if ($x509_cert["subject"]["CN"])
                  $certname = $x509_cert["subject"]["CN"];
                else if ($x509_cert["subject"]["OU"])
                  $certname = $x509_cert["subject"]["OU"];
                else if ($x509_cert["subject"]["O"])
                  $certname = $x509_cert["subject"]["O"];
                else if ($x509_cert["extensions"]["subjectKeyIdentifier"])
                  $certname = $x509_cert["extensions"]["subjectKeyIdentifier"];
                else
                  $certname = "";
                break;
              }
            }
            if ($certificate->type == "gpg") {
              $gpg_cert =  parse_gpg(trim($certificate->pem));
              if ($gpg_cert["fingerprint"] == $cert["fingerprint"]) {
                if ($type === "authenticode" || $type === "openssl" || $type === "liveupdate") {
                  $errors[] = ["error" => "Les taches de type " . $type . 
                            " ne supporte pas des certificates GPG"];
                  break 2;
                }
                if ($have_ca) {
                  $errors[] = ["error" => "Les taches de type " . $type . 
                               " ont besoin un seul certificate GPG"];
                  break 2;
                }
                $certname = $gpg_cert["uid"];
                $certok = true;
                $have_ca = true;
                break;
              }
            }
          }

          if (! $certok) {
            $cafile = dsas_ca_file();                                                      
            if ($cafile) {
              $ca = parse_x509($cafile);
              foreach ($ca as $x509_cert) {
                if ($x509_cert["fingerprint"] == $cert["fingerprint"]) {
                  if ($type === "rpm" || $type === "repomd" || $type === "deb" || $type === "gpg") {
                    $errors[] = ["error" => "Les taches de type " . $type . 
                              " ne supporte pas des certificates X509"];
                    break 2;
                  }
                  if ($have_ca) {
                    $errors[] = ["error" => "Les taches de type " . $type . 
                                 " ne supporte un seul certificate raçine"];
                    break 2;
                  }
                  $have_ca = true;
                  $certok = true;

                  if ($x509_cert["subject"]["CN"])
                    $certname = $x509_cert["subject"]["CN"];
                  else if ($x509_cert["subject"]["OU"])
                    $certname = $x509_cert["subject"]["OU"];
                  else if ($x509_cert["subject"]["O"])
                    $certname = $x509_cert["subject"]["O"];
                  else if ($x509_cert["extensions"]["subjectKeyIdentifier"])
                    $certname = $x509_cert["extensions"]["subjectKeyIdentifier"];
                  else
                    $certname = "";
                  break;
                }
              }
            }
          }

          if ($certok)
            $certs[] = ["name" => $certname, "fingerprint" => $cert["fingerprint"]];
          else
            $errors[] = ["error" => "Un des certificates n'existe pas"];
        }

        if ($type === "rpm" || $type === "repomd" || $type === "deb" || $type === "gpg") {
	  if (count($certs) != 1)
            $errors[] = ["error" => "Les taches de type " . $type . 
                         " ont besoin un certificate GPG"];
        }

        if ($errors == []) {
          $i = 0;
          foreach ($dsas->tasks->task as $task) {
            if ($task->name == $name) {
              unset($dsas->tasks->task[$i]);
              break;
            }
            $i++;
          }
          $newtask = $dsas->tasks->addChild("task");
          $newtask->name = $name;
          $newtask->id = dsasid();
          $newtask->directory = $directory;
          $newtask->uri = $uri;
          $newtask->type = $type;
          $newtask->run = $run;
          foreach ($certs as $cert) {
            $newcert = $newtask->addChild("cert");
            $newcert->name = $cert["name"];
            $newcert->fingerprint = $cert["fingerprint"];
          }
        }
        break;
 
     case "delete":   
        $id =  htmlspecialchars($_POST["id"]);
        $deltask = false;
        $i = 0;
        foreach ($dsas->tasks->task as $task) {
          if ($task->id == $id) {
            $deltask = true;
            unset($dsas->tasks->task[$i]);
            break;
          }
          $i++;
        }
        if (! $deltask)
           $errors[] = ["error" => "Le tache n'est pas trouv&eacute;"];
        break;

     case "run" :
        $id = $_POST["id"];;
        if (! ctype_xdigit($id)) {
          $errors[] = ["error" => "ID de la tache invalide;"];
        } else {
          $dsas_active = simplexml_load_file(_DSAS_XML . ".active");
          $runtask = false;
          foreach ($dsas_active->tasks->task as $task) {
            if ($task->id == $id) {
              $runtask = true;
              break;
            }
          }
          if ( ! $runtask) {
            $errors[] = ["error" => "La tache (" . $id . ") n'est pas active. Essaye d'appliquer avant"];
          } else {
            // Force the execution of the task with the "-f" flag
            exec("runtask -f " . escapeshellarg($id) . " > /dev/null &", $output, $retval);
            if ($retval != 0)
              $errors[] = ["error" => "Execution de la tache (" . $id . ") a &eacute;chouch&eacute;"];
          }
        }

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
  $i=1;
  foreach ($dsas->tasks->task as $task) {
    $tmp = dsas_run_log($task->id);
    $task->last = $tmp["last"];
    $task->status = $tmp["status"];
    $i++;
  }
  header("Content-Type: application/json");
  echo json_encode($dsas->tasks);
}

?>