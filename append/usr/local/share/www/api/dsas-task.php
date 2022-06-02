<?php
require_once "common.php";

if (! dsas_loggedin(false))
  header("HTTP/1.0 403 Forbidden");
else if($_SERVER["REQUEST_METHOD"] == "POST"){
  // Manually update for autologout after 600 seconds
  if ($_POST["op"] != "info")
    $_SESSION["timestamp"] = time();

  $errors = array();
  $info = "";

  try {
   $dsas = simplexml_load_file(_DSAS_XML);
   if (! $dsas)
     throw new RuntimeException("Error loading XML file");
  
    switch ($_POST["op"]){
      case "add":
        $data = json_decode($_POST["data"], true);
        $name = htmlspecialchars($data["name"]);
        if (trim($name) == "")
          $errors[] = ["error" => "The name can not be empty"];
        $id = $data["id"];
        $directory = htmlspecialchars($data["directory"]);
        if (trim($directory) == "")
          $errors[] = ["error" => "The directory name can not be empty"];
        $uri =  htmlspecialchars($data["uri"]);
        $type = $data["type"];
        if ($type !== "rpm" && $type !== "repomd" && $type !== "deb" && $type !== "authenticode" &&
            $type !== "openssl" && $type !== "gpg" && $type !== "liveupdate" && $type !== "cyberwatch")
          $errors[] = ["error" => "The task type is illegal"];
        $run = $data["run"];
        if ($run !== "never" && $run !== "quarterhourly" && $run !== "hourly" && $run !== "daily" && $run !== "weekly" && $run !== "monthly")
          $errors[] = ["error" => "The period between execution of the task is illegal"];
        $ca = $data["ca"];
        $ca_finger = strtolower(trim($ca["fingerprint"]));
        $ca_name = htmlspecialchars(trim($ca["name"]));
        if ($ca_finger !== "" && $ca_finger !== "self") {
          $ca_ok = false;
          foreach ($dsas->certificates->certificate as $certificate) {
            if ($certificate->type == "x509") {
              if ($certificate->authority == "true") {
                if (openssl_x509_fingerprint(trim($certificate->pem), "sha256") == $ca_finger) {
                  $ca_ok = true;
                  break;
                }
              }
            }
          }
          if (! $ca_ok)
            $errors[] = ["error" => "Certificate authority not found"];
        }

        if ($type === "deb") {
          foreach ($data["archs"] as $arch) {
            switch ($arch["arch"]){
              case "source":
              case "all":
              case "amd64":
              case "arm64":
              case "armel":
              case "armhf":
              case "i386":
              case "mips64el":
              case "mipsel":
              case "ppc64el":
              case "s390x":
                // Architecture ok
                if (!isset($arch["active"]))
                  $errors[] = ["error" => "Invalid debian architecture"];
                break;
              default:
                $errors[] = ["error" => "Invalid debian architecture"];
                break;
            }
          }
        }

        $certs = array();
        $have_ca = false;
        $have_pubkey = false;
        $have_x509 = false;
        foreach ($data["certs"] as $cert) {
          $certok = false;
          $certname = "";
          foreach ($dsas->certificates->certificate as $certificate) {
            if ($certificate->type == "x509") {
              if (openssl_x509_fingerprint(trim($certificate->pem), "sha256") == $cert["fingerprint"]) {
                if ($certificate->authority == "true") {
                  if ($have_ca && $type !== "liveupdate") {
                    $errors[] = ["error" => ["The task type '{0}' only supports one root certificate", $type]];
                    break 2;
                  }
                  $have_ca = true;
                }
                if ($type === "rpm" || $type === "repomd" || $type === "deb" || $type === "gpg") {
                  $errors[] = ["error" => ["The task type '{0}' does not support {1} certificates", $type, "X509"]];
                  break 2;
                }
                
                if ($have_pubkey && ($type === "cyberwatch" || $type === "openssl")) {
                  $errors[] = ["error" => ["The task type '{0}' can not include both public keys and X509 certificates", $type]];
                  break 2;
                } 

                $certok = true;
                $have_x509 = true;
                $x509_cert = openssl_x509_parse(trim($certificate->pem));
                if ($x509_cert === false)
                  $certname ="";
                else if ($x509_cert["subject"]["CN"])
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
                  $errors[] = ["error" => ["The task type '{0}' does not support {1} certificates", $type, "GPG"]];
                  break 2;
                }
                if ($type == "gpg" && $have_ca) {
                  $errors[] = ["error" => ["The task type '{0}' only supports one GPG certificate", $type]];
                  break 2;
                }
                $certname = $gpg_cert["uid"];
                $certok = true;
                $have_ca = true;
                break;
              }
            }

            if ($certificate->type == "pubkey") {
              $pem = trim($certificate->pem[0]);
              $pemnowrap = preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $pem);
              $pemnowrap = preg_replace('/\\s+/', '', $pemnowrap);
              if (hash("sha256", base64_decode($pemnowrap)) == $cert["fingerprint"]) {
                if ($type === "rpm" || $type === "repomd" || $type === "deb" || 
                    $type === "authenticode" || $type === "gpg" || $type === "liveupdate") {
                  $errors[] = ["error" => ["The task type '{0}' does not support public keys", $type]];
                  break 2;
                }
                if ($have_x509) {
                  $errors[] = ["error" => ["The task type '{0}' can not include both public keys and X509 certificates", $type]];
                  break 2;
                }
                if ($have_pubkey) {
                  $errors[] = ["error" => ["The task type '{0}' can only support a single public key", $type]];
                  break 2;
                }

                $certname = $certificate->name;
                $certok = true;
                $have_pubkey = true;
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
                    $errors[] = ["error" => ["The task type '{0}' does not support {1} certificates", $type, "X509"]];
                    break 2;
                  }
                  if ($have_ca) {
                    $errors[] = ["error" => ["The task type '{0}' only supports one root certificate", $type]];
                    break 2;
                  }
                  if ($have_pubkey) {
                    $errors[] = ["error" => ["The task type '{0}' can not include both public keys and X509 certificates", $type]];
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
            $errors[] = ["error" => "One of the certificates does not exist"];
        }

        if ($type === "rpm" || $type === "repomd" || $type === "gpg") {
	  if (count($certs) != 1)
            $errors[] = ["error" => ["The task type '{0}' requires a GPG certificate", $type]]; 
        }

        if ($type === "openssl" || $type === "cyberwatch" || $type == "deb") {
	  if (count($certs) < 1)
            $errors[] = ["error" => ["The task type '{0}' at least one certificate or public key", $type]]; 
        }

        if ($errors == []) {
          $nt = 0;
          foreach ($dsas->tasks->task as $task) {
            if ($task->id == $id) {
              if ($directory != $task->directory) {
                dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . interco_haut(), "sudo", "sudo", "-u", "haut", "mv", "-n", _DSAS_HAUT . "/" . $task->directory, _DSAS_HAUT . "/" . $directory]);
                dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . interco_haut(), "sudo", "sudo", "-u", "verif", "mv", "-n", _DSAS_BAS . "/" . $task->directory, _DSAS_BAS . "/" . $directory]);
                dsas_exec(["sudo", "sudo", "-u", "haut", "mv", "-n", _DSAS_HAUT . "/" . $task->directory, _DSAS_HAUT . "/" . $directory]);
                dsas_exec(["sudo", "sudo", "-u", "verif", "mv", "-n", _DSAS_BAS . "/" . $task->directory, _DSAS_BAS . "/" . $directory]);
              }
              while ($dsas->tasks[0]->task[$nt]->cert[0])
                unset($dsas->tasks[0]->task[$nt]->cert[0]);
              unset($dsas->tasks[0]->task[$nt]->archs[0]);
              break;
            }
            $nt++;
          }
          if ($nt === $dsas->tasks->task->count()) {
            $task = $dsas->tasks[0]->addChild("task");
            $task->id[0] = dsasid();
            $task->name[0] = $name;
          }
          $dsas->tasks[0]->task[$nt]->directory[0] = $directory;
          $dsas->tasks[0]->task[$nt]->uri[0] =  $uri;
          $dsas->tasks[0]->task[$nt]->type[0] = $type;
          $dsas->tasks[0]->task[$nt]->run[0] = $run;
          $dsas->tasks[0]->task[$nt]->ca[0]->fingerprint[0] = $ca_finger;
          $dsas->tasks[0]->task[$nt]->ca[0]->name[0] = $ca_name;
          foreach ($certs as $cert) {
            $newcert = $dsas->tasks[0]->task[$nt]->addChild("cert");
            $newcert->name[0] = $cert["name"];
            $newcert->fingerprint[0] = $cert["fingerprint"];
          }
          if ($type === "deb") {
            $newarch = $dsas->tasks[0]->task[$nt]->addChild("archs");
            foreach ($data["archs"] as $arch) {
              switch ($arch["arch"]){
                case "source":
                case "all":
                case "amd64":
                case "arm64":
                case "armel":
                case "armhf":
                case "i386":
                case "mips64el":
                case "mipsel":
                case "ppc64el":
                case "s390x":
                // Architecture ok
                  if ($arch["active"])
                    $newarch->addChild("arch", $arch["arch"]);
                break;
              }
            }
          }
        }
        break;
 
     case "delete":   
        $id =  $_POST["id"];
        $del = $_POST["delete"];
        if (! ctype_xdigit($id)) {
          $errors[] = ["error" => "The task ID is invalid"];
        } else {
          $deltask = false;
          $i = 0;
          foreach ($dsas->tasks->task as $task) {
            if ($task->id == $id) {
              if (dsas_task_running($id)) {
                $errors[] = ["error" => "Can not delete running task"];
              } else {
                if ($del == "true") {
                  dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . interco_haut(), "sudo", "sudo", "-u", "haut", "rm", "-fr", _DSAS_HAUT . "/" . $task->directory]);
                  dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . interco_haut(), "sudo", "sudo", "-u", "verif", "rm", "-fr", _DSAS_BAS . "/" . $task->directory]);
                  dsas_exec(["sudo", "sudo", "-u", "haut", "rm", "-fr", _DSAS_HAUT . "/" . $task->directory]);
                  dsas_exec(["sudo", "sudo", "-u", "verif", "rm", "-fr", _DSAS_BAS . "/" . $task->directory]);
                }
                unset($dsas->tasks->task[$i]);
              }
              $deltask = true;
              break;
            }
            $i++;
          }
          if (! $deltask)
            $errors[] = ["error" => "The task was not found"];
        }
        break;

     case "run" :
        $id = $_POST["id"];
        if (! ctype_xdigit($id)) {
          $errors[] = ["error" => "The task ID is invalid"];
        } else {
          $dsas_active = simplexml_load_file(_DSAS_XML . ".active");
          if (! $dsas_active)
            throw new RuntimeException("Error loading XML file");  
          $runtask = false;
          $i = 0;
          foreach ($dsas_active->tasks->task as $task) {
            if ($task->id == $id) {
              $runtask = true;
              break;
            }
            $i++;
          }
          if ( ! $runtask) {
            $errors[] = ["error" => ["The task '{0}' is not active. Try applying before use",  $id]];
          } else if (dsas_task_running($id)) {
            $errors[] = ["error" => ["The task '{0}' is already running",  $id]];
          } else if ($dsas->tasks->task[$i]->asXml() !== $dsas_active->tasks->task[$i]->asXml()) {
            $errors[] = ["error" => ["The task '{0}' is modified. Try applying before use",  $id]];
          } else {
            // Create task log directory if needed
            if (! is_dir(_DSAS_LOG . "/tasks")) {
              mkdir(_DSAS_LOG . "/tasks", 0775);
              chgrp(_DSAS_LOG . "/tasks", "verif");
            }
            // Force the execution of the task with the "-f" flag.
            // FIXME : seems that we can't use dsas_exec ad it hands
            exec("runtask -v -f " . $id . " >& " . _DSAS_LOG . "/tasks/" . $id . ".log &");
          }
        }

        break;

     case "kill" :
        $id = $_POST["id"];
        if (! ctype_xdigit($id)) {
          $errors[] = ["error" => "The task ID is invalid"];
        } else {
          $dsas_active = simplexml_load_file(_DSAS_XML . ".active");
          if (! $dsas_active)
            throw new RuntimeException("Error loading XML file"); 
          $killtask = false;
          foreach ($dsas_active->tasks->task as $task) {
            if ($task->id == $id) {
              $killtask = true;
              break;
            }
          }
          if ( ! $killtask) {
            $errors[] = ["error" => ["The task '{0}' is not active. Try applying before use",  $id]];
          } else if (! dsas_task_running($id)) {
            $errors[] = ["error" => ["The task '{0}' is not running",  $id]];
          } else {
             dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . interco_haut(), "sudo", "/usr/local/sbin/killtask", $id]);
             dsas_exec(["sudo", "/usr/local/sbin/killtask", $id]);
          }
        }

        break;

      case "info" :
        $id = $_POST["id"];
        $len = $_POST["len"];
        if (! ctype_xdigit($id)) {
          $errors[] = ["error" => "The task ID is invalid"];
        } else {
          $dsas_active = simplexml_load_file(_DSAS_XML . ".active");
          if (! $dsas_active)
            throw new RuntimeException("Error loading XML file"); 
          $infotask = false;
          foreach ($dsas_active->tasks->task as $task) {
            if ($task->id == $id) {
              $infotask = true;
              break;
            }
          }
          if ( ! $infotask) {
            $errors[] = ["error" => ["The task '{0}' is not active. Try applying before use",  $id]];
          } else {

           if (empty($len))
             $len = 0;
           $info = dsas_get_log($len, _DSAS_LOG . "/tasks/" . $id . ".log");
          }
        }
        break;

      case "name" :
        $data = json_decode($_POST["data"], true);
        $old = $data["old"];
        $id = $data["id"];
        foreach ($dsas->tasks->task as $task) {
          if ($task->name == $old && $task->id == $id) {
            $task->name = $data["new"];
            break;
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
    if ($_POST["op"] !== "info")
      echo "Ok";
    else {
      header("Content-Type: application/json");
      echo json_encode($info);
    }
    if ($_POST["op"] === "add" || $_POST["op"] === "delete" ||$_POST["op"] === "name")
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
    $i=1;
    foreach ($dsas->tasks->task as $task) {
      $tmp = dsas_run_log($task->id);
      $task->last = $tmp["last"];
      $task->status = $tmp["status"];
      if (empty($task->ca->fingerprint)) {
        $task->ca->name = "";
        $task->ca->fingerprint = "";
      }
      $i++;
    }
    header("Content-Type: application/json");
    echo json_encode($dsas->tasks);
  }
}

?>
