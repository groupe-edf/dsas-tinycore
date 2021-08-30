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
        $data = $_POST["data"];;
        $name = htmlspecialchars($data["name"]);
        if (trim($name) == "")
          $errors[] = ["error" => "Le nom ne peut pas être vide"];
        $directory = htmlspecialchars($data["directory"]);
        if (trim($directory) == "")
          $errors[] = ["error" => "Le directoire ne peut pas être vide"];
        $uri =  htmlspecialchars($data["uri"]);
        $type = $data["type"];
        if ($type !== "rpm" && $type !== "repomd" && $type !== "deb" && $type !== "authenticode" &&
            $type !== "openssl" && $type !== "gpg")
          $errors[] = ["error" => "Le type de tache est illegale"];
        $run = $data["run"];
        if ($run !== "never" && $run !== "hourly" && $run !== "daily" && $run !== "weekly" && $run !== "monthly")
          $errors[] = ["error" => "Le periode entre les execution de la tache est illegale"];
        $certs = array();
        foreach ($data["certs"] as $cert) {
          $certok = false;
          $certname = "";
          foreach ($dsas->certificates->certificate as $certificate) {
            if ($certificate->type == "x509") {
              $x509_cert =  openssl_x509_parse(trim($certificate->pem));
              if ($x509_cert["extensions"]["subjectKeyIdentifier"] == $cert["fingerprint"]) {
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
            if ($certificate->type == "gpg") {
              $gpg_cert =  parse_gpg(trim($certificate->pem));
              if ($gpg_cert["fingerprint"] == $cert["fingerprint"]) {
                $certname = $gpg_cert["uid"];
                $certok = true;
                break;
              }
            }
          }

          if (! $certok) {
            $cafile = dsas_ca_file();                                                      
            if ($cafile) {
              $ca = parse_x509($cafile);
              foreach ($ca as $x509_cert) {
                if ($x509_cert["extensions"]["subjectKeyIdentifier"] == $cert["fingerprint"]) {
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
        $data = $_POST["data"];
        $id = htmlspecialchars($data["id"]);
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
        $data = $_POST["data"];;
        $id = $data["id"];
        if (! ctype_xdigit($id)) {
          $errors[] = ["error" => "ID de la tache invalide;"];
        } else {
          // Force the execution of the task with the "-f" flag
          exec("runtask -f " . escapeshellarg($id), $output, $retval);
          if ($retval != 0)
            $errors[] = ["error" => "Execution de la tache (" . $id . ") a &eacute;chouch&eacute;"];
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
    $tmp = dsas_run_log($id);
    $task->last = $tmp["last"];
    $task->status = $tmp["status"];
    $i++;
  }
  header("Content-Type: application/json");
  echo json_encode($dsas->tasks);
}

?>