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

$uri = (string)parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = explode( '/', $uri );

// FIXME: Should this code be split up more into seperate functions ?

// This code is responsable for the routing of the REST API requests 
if (count($uri) < 4) {
  header("HTTP/1.1 404 Not Found");
  exit();
} else if (($uri[3] == "passwd") || ($uri[3] == "logout")) {
  // The API /api/*/passwd and /api/*/logout are accessible to non admin users
  if (! dsas_loggedin(true, false)) {
    header("HTTP/1.0 403 Forbidden");
    exit();
  }
} else if (($uri[3] == "status" ) || ($uri[3] == "logs") || ((count($uri) > 4) && ($uri[3] == "tasks") && ($uri[4] == "info"))) {
  // These APIs should update the logout timer, as automatic
  if (! dsas_loggedin(false)) {
    header("HTTP/1.0 403 Forbidden");
    exit();
  }
} else {
  if (! dsas_loggedin()) {
    header("HTTP/1.0 403 Forbidden");
    exit();
  }
}

try {
  if ($_SERVER["REQUEST_METHOD"] == "POST") {
    switch ($uri[3]){
      case "backup":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
        try {
          // This will throw an error in case of a problem which is caught below 
          check_files($_FILES["file"], "application/gzip");

          // The contents of the tar files is controlled in dsasbackup
          if (empty($_POST["passwd"]))
            $ret = dsas_exec(["/usr/local/sbin/dsasbackup", "-r", $_FILES["file"]["tmp_name"]]);
           else
            $ret = dsas_exec(["/usr/local/sbin/dsasbackup", "-r", $_FILES["file"]["tmp_name"], "-p", $_POST["passwd"]]);
          if ($ret["retval"] != 0)
            throw new RuntimeException($ret["stderr"]);
          echo json_encode($ret);
        }  catch (RuntimeException $e) {
          header("Content-Type: application/json");
          echo json_encode([["restore" => ["Error during the restoration : {0}", $e->getMessage()]]]);
        }
        break;

      case "cert":
        if (count($uri) != 5)
          throw new RuntimeException("Not found");

        switch ($uri[4]) {
          case "drag":
            $errors = dsas_drag_cert($_POST["from"], $_POST["to"]);
            break;
            
          case "x509":
          case "pubkey":
            $errors = dsas_upload_cert($uri[4], $_FILES["file"], "text/plain");
            break;

          case "gpg":
            $errors = dsas_upload_cert($uri[4], $_FILES["file"], "application/pgp-keys");
            break;

          default:
            throw new RuntimeException("Not found");
        }
        header("Content-Type: application/json");
        if ($errors == []) {
          echo json_encode(["retval" => 0]); 
        } else {
          echo json_encode($errors);
        } 
        break;

      case "net":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");

        /** @var array{bas: array{dhcp: string, cidr: string, gateway: string, 
          *                       dns: array{domain: string, nameserver: string[]}},
          *            haut: array{dhcp: string, cidr: string, gateway: string, 
          *                       dns: array{domain: string, nameserver: string[]}}} $data */
        $data = json_decode($_POST["data"], true);
        $errors = dsas_net($data);
        header("Content-Type: application/json");
        if ($errors == []) {
          echo json_encode(["retval" => 0]); 
        } else {
          echo json_encode($errors);
        } 
        break;
        
      case "passwd":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
          
        $dsas = simplexml_load_file(_DSAS_XML);
        if ($dsas === false) {
          header("Content-Type: application/json");
          echo json_encode(["error" => "Error loading XML file"]);
          die();
        }
        /** @var array{username: string, passwd: string} $data */
        $data = json_decode($_POST["data"], true);
        $errors = array();
        if ($data["username"] != $_SESSION["username"])
          $errors[] = ["error" => ["Attempt to change password of a different user",  (string)$data["username"]]];
        else {
          $found = false;
          foreach ($dsas->config->users->user as $user) {
            if ($user->username == $data["username"]) {
              $found = true;
              $passwd = $data["passwd"];
              $name = $data["username"];
              if ($passwd != str_replace("/\s+/", "", $passwd))
                $errors[] = [$name => "The password can not contain white spaces"];
              else if (! complexity_test($passwd))
                $errors[] = [$name => "The password is insufficiently complex"];
              else {
                $ret = change_passwd($name, $passwd, $dsas->config->users->hash);
                if ($ret["retval"] != 0) {
                  $errors[] = [$name => $ret["stderr"]];
                } else {
                  if ($user->username == "tc")
                    unset($dsas->config->users->first);

                  // To make the password change permanent across a reboot need to backup
                  // /etc/shadow on both machines. Can't use 'filetool.sh -b' for this as
                  // unsaved changes by an adminstrator will also be backed up. Have to
                  // untar the existing backup in tgz format, replace /etc/shadow and 
                  // rearchive it. This is going to be ugly !! Package the ugliness in a 
                  // script
                  $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@haut", "/usr/local/sbin/dsaspasswd"]);
                  if ($output["retval"] != 0)
                    $errors[] = ["error" => ["Error during user addition '{0}'", (string)$output["stderr"]]];
                  else {
                    $output = dsas_exec(["/usr/local/sbin/dsaspasswd"]);
                    if ($output["retval"] != 0)
                      $errors[] = ["error" => ["Error during user addition '{0}'", (string)$output["stderr"]]];
                  }            
                }
              }
              break;
            }
          }
          if (! $found)
            $errors[] = ["error" => ["The user '{0}' does not exist",  (string)$data["username"]]];
        }
        if ($dsas !== false && $errors == []) {
          $dsas->asXml(_DSAS_XML);
          echo json_encode(["retval" => 0]);
        } else  {
          header("Content-Type: application/json");
          echo json_encode($errors);
        }    
        break;

      case "service" :
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
          
         /** @var array{ssh: array{active: string, user_tc: string, 
          *                       user_bas: string, user_haut: string},
          *            radius: array{active: string, server: string, secret: string, domain: string},
          *            syslog: array{active: string, server: string},
          *            ntp: array{active: string, server: array{string}},
          *            antivirus: array{active: string, uri: string},
          *            web: array{repo: string},
          *            snmp: array{active: string, username: string, password: string,
                                   encrypt: string, passpriv: string, 
                                   privencrypt: string}} $data */
        $data = json_decode($_POST["data"], true);
        $errors = dsas_service($data);
        if ($errors == []) {
          echo json_encode(["retval" => 0]);
        } else  {
          header("Content-Type: application/json");
          echo json_encode($errors);
        }
        break;
        
      case "tasks":
        $id="";
        if (count($uri) == 5) {
          if (($uri[4] != "add") && ($uri[4] != "drag"))
            throw new RuntimeException("Not found");
        } else if (count($uri) != 6) {
          throw new RuntimeException("Not found");      
        } else
          $id = $uri[5];

        $info = "";
        $errors = array();
        $dsas = simplexml_load_file(_DSAS_XML);
        if (! $dsas)
          $errors[] = ["error" => "Error loading XML file"];
        else {
          switch ($uri[4]) {
            case "add":
              /** @var array{name: string, id: string, type: string, 
                * run: string, directory: string, uri: string,
                * ca: array{name: string, fingerprint: string},
                * archs: array{array{arch: string, active: string}},
                * certs: array{array{name: string, fingerprint: string}}} $data */
              $data = json_decode($_POST["data"], true);
              $errors = dsas_add_task($data);
              break;

            case "drag":
              $from = $_POST["from"];
              $to = $_POST["to"];
              if (! ctype_digit($from)) {
                $errors[] = ["error" => "The task drag from value is invalid"];
              } else if (! ctype_digit($to)) {
                $errors[] = ["error" => "The task drag to value is invalid"];
              } else {
                $from = intval($from);
                $to = intval($to);
                $nt =  $dsas->tasks[0]->count();
                if ($from < 0 || $to < 0 || $from > $nt - 1 || $to > $nt - 1) {
                  $errors[] = ["error" => "The task drag is invalid"];
                } else  if ($from !== $to && $from !== $to + 1) {
                  $task = new SimpleXMLElement($dsas->tasks[0]->task[$from]->asXML());
                  $task_to = $dsas->tasks[0]->task[$to];
                  unset($dsas->tasks->task[$from]);
                  simplexml_insert_after($task, $task_to);
                }
              }
              break;

            case "info":
              $len = $_POST["len"];
              if (! ctype_xdigit($id)) {
                $errors[] = ["error" => "The task ID is invalid"];
              } else {
                $dsas_active = simplexml_load_file(_DSAS_XML . ".active");
                if (! $dsas_active)
                  $errors[] = ["error" => "Error loading XML file"];
                else {
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
              }          
              break;

            case "kill":
              if (! ctype_xdigit($id)) {
                $errors[] = ["error" => "The task ID is invalid"];
              } else {
                $dsas_active = simplexml_load_file(_DSAS_XML . ".active");
                if (! $dsas_active)
                  $errors[] = ["error" => "Error loading XML file"];
                else {
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
              }
              break;

            case "name":
              /** @var array{old: string, new: string} */
              $data = json_decode($_POST["data"], true);
              $old = $data["old"];
              foreach ($dsas->tasks->task as $task) {
                if ($task->name == $old && $task->id == $id) {
                  $task->name = $data["new"];
                  break;
                }
              }
              break;

            case "run":
              if (! ctype_xdigit($id)) {
                $errors[] = ["error" => "The task ID is invalid"];
              } else {
                $dsas_active = simplexml_load_file(_DSAS_XML . ".active");
                if (! $dsas_active)
                  $erros[] = ["error" => "Error loading XML file"];
                else {
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
                    // FIXME : seems that we can't use dsas_exec as it stands
                    exec("runtask -v -f " . $id . " >& " . _DSAS_LOG . "/tasks/" . $id . ".log &");
                  }
                }
              }
              break;
              
            default:
              header("HTTP/1.1 404 Not Found");
              exit();
          }
        }
        header("Content-Type: application/json");
        if (($dsas != false) && ($errors == [])) {
          if ($uri[4] === "name" || $uri[4] === "drag")
            $dsas->asXml(_DSAS_XML);
          if ($uri[4] == "info")
            echo json_encode($info);
          else
            echo json_encode(["retval" => 0]);
        } else {
          echo json_encode($errors);
        } 
        break;

      case "users":
        $user="";
        if (count($uri) == 6) {
          if (($uri[4] != "add") && ($uri[4] != "passwd"))
            throw new RuntimeException("Not found");
          $user = $uri[5];
        } else if (count($uri) != 5) {
          throw new RuntimeException("Not found");      
        }
        
        $dsas = simplexml_load_file(_DSAS_XML);
        if ($dsas === false) {
          header("Content-Type: application/json");
          echo json_encode(["error" => "Error loading XML file"]);
          die();
        }
        
        $errors = array();
        switch ($uri[4]) {
          case "add":
            if (! preg_match('/^[a-z_]([a-z0-9_-]{0,31}|[a-z0-9_-]{0,30}\$)$/', $user)) {
              $errors[] = ["error" => ["Username '{0}' is illegal", $user]];
            } else {
              $found = false;
              foreach ($dsas->config->users->user as $_user) {
                if ($_user->username == $user) {
                  $found = true;
                  break;
                }
              }
              if ($found) {
                $errors[] = ["error" => ["The user '{0}' already exists",  $user]];
              } else {
                $newuser = $dsas->config->users->addChild("user");
                $newuser->username = $user;
                $newuser->description = "";
                $newuser->type = "admin";
                $newuser->active = "false";
                $output = dsas_exec(["sudo", "adduser", "-G", "users", "-h", _DSAS_HOME . "/" . $user, "-s", "/bin/sh", "-D", $user]);
                if ($output["retval"] != 0)
                  $errors[] = ["error" => ["Error during user addition '{0}'", (string)$output["stderr"]]];
                dsas_exec(["sudo", "chmod", "go-rwx", _DSAS_HOME ."/" . $user]);
              }
            }
            break;
            
          case "drag" :
            $from = intval($_POST["from"]);
            $to = intval($_POST["to"]);
            $nt =  $dsas->config->users[0]->count();
            if ($from < 1 || $to < 0 || $from > $nt - 1 || $to > $nt - 1) {
              $errors[] = ["error" => "The user drag is invalid"];
            } else  if ($from !== $to && $from !== $to + 1) {
              $_user = new SimpleXMLElement($dsas->config->users[0]->user[$from]->asXML());
              $user_to = $dsas->config->users[0]->user[$to];
              unset($dsas->config->users->user[$from]);
              simplexml_insert_after($_user, $user_to);
            }
            break;
            
          case "modify":
            /** @var array{username: string, passwd: string, description: string, type: string, active: string} $data */
            $data = json_decode($_POST["data"], true);
            /** @var array{username: string, passwd: string, description: string, type: string, active: string} $duser */  
            foreach ($data as $duser) {
              $found = false;
              $i = 0;         
              foreach ($dsas->config->users->user as $_user) {
                if ($duser["username"] == $_user->username) {
                  $found = true;
                  if ($duser["username"] != "tc" && $duser["username"] != $_SESSION["username"]) {
                    $dsas->config->users->user[$i]->description = htmlspecialchars(trim((string)$duser["description"]));
                    switch ($duser["type"]) {
                      case "admin":
                      case "bas":
                      case "haut":
                        $dsas->config->users->user[$i]->type = $duser["type"];
                        break;
                      default:
                        $errors[] = ["error" => ["User type '{0}' is illegal", $duser["type"]]];
                        break;
                    }
                  }
                  $dsas->config->users->user[$i]->active = ($duser["active"] === "true" ? "true" : "false");
                  break;
                }
                $i++;
              }
              if (! $found)
                $errors[] = ["error" => ["The user '{0}' does not exist",  $duser["username"]]];          
            }
            break;

          case "passwd":
            $found = false;
            foreach ($dsas->config->users->user as $_user) {
              if ($_user->username == $user) {
                $found = true;
                $passwd = $_POST["passwd"];
                if ($passwd != str_replace("/\s+/", "", $passwd))
                  $errors[] = [$user => "The password can not contain white spaces"];
                else if (! complexity_test($passwd))
                  $errors[] = [$user => "The password is insufficiently complex"];
                else {
                  $ret = change_passwd($user, $passwd, $dsas->config->users->hash);
                  if ($ret["retval"] != 0) {
                    $errors[] = [$user => $ret["stderr"]];
                  } else if ($user == "tc") {
                    unset($dsas->config->users->first);
                  }
                }
                break;
              }
            }
            if (! $found)
              $errors[] = ["error" => ["The user '{0}' does not exist",  (string)$user]];            
            break;
            
          default:
            header("HTTP/1.1 404 Not Found");
            exit();
        }
        header("Content-Type: application/json");
        if ($errors == []) {
          $dsas->asXml(_DSAS_XML);
          echo json_encode(["retval" => 0]);
        } else {
          echo json_encode($errors);
        }        
        break;
        
      case "web":
        $errors = [];
        if (count($uri) != 5)
          throw new RuntimeException("Not found");
      
        switch ($uri[4]) {
          case "upload":
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
            $errors = renew_web_cert($options, $validity);
            break;
            
          default:
            header("HTTP/1.1 404 Not Found");
            exit();
        }
        
        header("Content-Type: application/json");
        if ($errors == [])
          echo json_encode(["retval" => 0]);
        else
          echo json_encode($errors);
        break;
        
      default:
        header("HTTP/1.1 404 Not Found");
        break;
    }
  } else if ($_SERVER["REQUEST_METHOD"] == "GET")  {
    switch ($uri[3]){
      case "apply":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
            
        // exec here for now, use proc_open to avoid shell if user input is supplied
        $haut = interco_haut();

        // FIXME Can't use dsas_exec here as this command sent a HUP to the very server
        // on which this PHP code is running. So dsas_exec will hang in this case. 
        // exceptionally we use "exec" that seems to work.
        exec("sudo /etc/init.d/services/dsas apply", $dummy, $retval);
        $output["stderr"] = "Error in apply on lower machine";
        $output["retval"] = $retval;

        if ($output["retval"] == 0) 
          $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . $haut, "cp", "/var/dsas/dsas_conf.xml", "/var/dsas/dsas_conf.xml.old"]);
        if ($output["retval"] == 0) {
          copy("/var/dsas/dsas_conf.xml", "/tmp/dsas_conf.xml");
          chmod("/tmp/dsas_conf.xml", 644);
          $output = dsas_exec(["sudo", "sudo", "-u", "haut", "scp", "/tmp/dsas_conf.xml", "tc@" . $haut . ":/tmp"]);
          unlink("/tmp/dsas_conf.xml");
        }
        if ($output["retval"] == 0)
          $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . $haut, "mv", "/tmp/dsas_conf.xml", "/var/dsas/dsas_conf.xml"]);
        if ($output["retval"] == 0) 
          $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . $haut, "chgrp", "verif", "/var/dsas/dsas_conf.xml"]);
        if ($output["retval"] == 0) 
          $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . $haut, "chmod", "640", "/var/dsas/dsas_conf.xml"]);
        if ($output["retval"] == 0)
          $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . $haut, "sudo", "/etc/init.d/services/dsas", "apply"]);
        if ($output["retval"] != 0)
          header("HTTP/1.0 500 Internal Server Error: " . explode("/n", $output["stderr"])[0]);
        else {
          header("Content-Type: application/json");
          echo json_encode(["retval" => $retval, "output" => $output]);
        }
        break;

      case "backup":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");

        $BKP = "/tmp/dsasbackup.tgz";
        if (empty($_GET["passwd"]))
          $ret = dsas_exec(["/usr/local/sbin/dsasbackup", $BKP]);
        else
          $ret = dsas_exec(["/usr/local/sbin/dsasbackup", $BKP, "-p", $_GET["passwd"]]);
        if ($ret["retval"] != 0)
          header("HTTP/1.0 500 Internal Server Error: " . $ret["stderr"]);
        else {
          if ($fp = fopen($BKP, "rb")) {
            $backup = fread($fp, (int)filesize($BKP));
            fclose($fp);
            header("Content-Type: application/json");
            echo json_encode(["file" => base64_encode((string)$backup)]);
          } else
            header("HTTP/1.0 500 Internal Server Error");
        }
        break;

      case "cert":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
        try {
          header("Content-Type: application/json");
          echo json_encode(dsas_get_cert());
        } catch (RuntimeException $e) {
          header("HTTP/1.0 500 Internal Server Error");
        }
        break;

      case "logout":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
          
        $cnxstr = $_SERVER["REMOTE_ADDR"];
        if (!empty($_SERVER["HTTP_X_FORWARDED_FOR"]))
           $cnxstr = $cnxstr . " [" . $_SERVER["HTTP_X_FORWARDED_FOR"] . "]";
        else if (!empty($_SERVER["HTTP_CLIENT_IP"]))
           $cnxstr = $cnxstr . " [" . $_SERVER["HTTP_CLIENT_IP"] . "]";

        // Unset all of the session variables
        $_SESSION = array();

        // Destory the session
        session_destroy();

        syslog(LOG_NOTICE, "Succesful DSAS logout from " . $cnxstr);
        echo json_encode(["retval" => 0]);

        break;

      case "logs":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
          
        header("Content-Type: application/json");
        if (! array_key_exists("REFRESH_LEN", $_GET)) {
          echo json_encode(dsas_get_logs());
        } else {
          echo json_encode(dsas_get_log($_GET["REFRESH_LEN"]));
        }
        break;
        
      case "net":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
          
        $dsas = simplexml_load_file(_DSAS_XML);
        if (! $dsas)
          header("HTTP/1.0 500 Internal Server Error");
        else {
          header("Content-Type: application/json");
          echo json_encode($dsas->config->network);
        }  
        break;
        
      case "passwd":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
          
        $dsas = simplexml_load_file(_DSAS_XML);
        if (! $dsas)
          header("HTTP/1.0 500 Internal Server Error");
        else {
          header("Content-Type: application/json");
          $i = 0;
          $found = false;
          foreach ($dsas->config->users->user as $user) {
            if ($user->username == $_SESSION["username"]) {
              $found = true;
              break;
            }
            $i++;
          }
          if ($found)
            echo json_encode($dsas->config->users->user[$i]);
        }
        break;

      case "reboot":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
          
        // Must use exec here as dsas_exec returns an unwanted error while web server is shutting down
        exec("sudo sudo -u haut ssh tc@" . interco_haut() . " /usr/bin/sudo /sbin/reboot", $output, $retval);
        // The above will give an error is the machine haut is down. So don't test for an error
        // here before taking the machine bas down
        exec("/usr/bin/sudo /sbin/reboot", $output, $retval);
        if ($retval != 0)
          header("HTTP/1.0 500 Internal Server Error");
        else {
          header("Content-Type: application/json");
          echo json_encode(["retval" => $retval, "output" => $output]);
        }
        break;

      case "save":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
          
        $output = dsas_exec(["/usr/bin/sudo", "/usr/bin/filetool.sh", "-b"]);
        if ($output["retval"] != 0)
          header("HTTP/1.0 500 Internal Server Error");
        else {
          header("Content-Type: application/json");
          echo json_encode($output);
        }
        break;
        
      case "service" :
        $dsas = simplexml_load_file(_DSAS_XML);
        if (! $dsas)
          header("HTTP/1.0 500 Internal Server Error");
        else {
          header("Content-Type: application/json");
          // Ensure that the JSON includes the radius domain even if the xml doesn't
          if (! isset($dsas->config->radius->domain))
            $dsas->config->radius->domain = "";
          echo json_encode($dsas->config);
        }
        break;

      case "shutdown":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
          
        // Must use exec here as dsas_exec returns an unwanted error while web server is shutting down
        exec("sudo sudo -u haut ssh tc@" . interco_haut() . " /usr/bin/sudo /sbin/poweroff", $output, $retval);
        // The above will give an error is the machine haut is down. So don't test for an error
        // here before taking the machine bas down
        exec("/usr/bin/sudo /sbin/poweroff", $output, $retval);
        if ($retval != 0)
          header("HTTP/1.0 500 Internal Server Error");
        else {
          header("Content-Type: application/json");
          echo json_encode(["retval" => $retval, "output" => $output]);
        }      
        break;
        
      case "status":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
          
        header("Content-Type: application/json");
        echo json_encode(dsas_status());
        break;
        
      case "tasks":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");      
      
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
        break;

      case "users":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");

        $dsas = simplexml_load_file(_DSAS_XML);
        if (! $dsas)
          header("HTTP/1.0 500 Internal Server Error");
        else {
          header("Content-Type: application/json");
          echo json_encode($dsas->config->users);
        }
        break;

      case "warning":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
          
        $dsas = simplexml_load_file(_DSAS_XML);
        $warn = array();

        if ($dsas === false)
          $warn = ["type" => "warn", "msg" => "Error loading XML file"];
        else {
          if (force_passwd()) $warn[] =
             ["type" => "error", "msg" => "First use. All of the passwords must be changed."];
          if ($dsas->tasks->task->count() == 0) $warn[] = 
             ["type" => "warn", "msg" => "No tasks are configured."];
        }
        header("Content-Type: application/json");
        echo json_encode($warn);
        break;

      case "web":
        if (count($uri) != 4)
          throw new RuntimeException("Not found");
          
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
        break;

      default:
        header("HTTP/1.1 404 Not Found");
        break;
    }
  } else if ($_SERVER["REQUEST_METHOD"] == "DELETE")  {
    switch ($uri[3]){
      case "cert":
        $errors = [];
        if (count($uri) != 5)
          throw new RuntimeException("Not found");  
        $errors = dsas_delete_cert($uri[4]);
        header("Content-Type: application/json");
        if ($errors == [])
          echo json_encode(["retval" => 0]);
        else
          echo json_encode($errors);
        break;
        
      case "users":
        $errors = [];
        if (count($uri) != 5)
          throw new RuntimeException("Not found");  
        $user = $uri[4];
        $dsas = simplexml_load_file(_DSAS_XML);
        if ($dsas == false || $dsas == null) {
          $errors[] = ["error" => "Error loading XML file"];
        } else if ($user === "tc") {
          $errors[] = [ "error" => "Can not remove the user 'tc'"];
        } else if ($user === $_SESSION["username"]) {
          $errors[] = [ "error" => ["Can not remove loggedin user '{0}'", $user]];
        } else {        
          $found = false;
          $i = 0;
          foreach ($dsas->config->users->user as $_user) {
            if ($_user->username == $user) {
              $found = true;
              unset($dsas->config->users->user[$i]);
              $output = dsas_exec(["sudo", "deluser", "--remove-home", $user]);
              if ($output["retval"] != 0) {
                $errors[] = ["error" => ["Error during user deletion '{0}'", (string)$output["stderr"]]];
                $dsas->asXml(_DSAS_XML); // Even if there is as error here, want to get rid of the user
              }
              break;
            }
            $i++;
          }
          if (! $found)
            $errors[] = ["error" => ["The user '{0}' does not exist",  (string)$user]];
        }
        header("Content-Type: application/json");
        if ($dsas != false && $errors == []) {
          $dsas->asXml(_DSAS_XML);
          echo json_encode(["retval" => 0]);
        } else
          echo json_encode($errors);
        break;

      case "tasks":
      case "tasks-all":
        $errors = [];
        if (count($uri) != 5)
          throw new RuntimeException("Not found");  
        $id = $uri[4];
        
        $dsas = simplexml_load_file(_DSAS_XML);
        if ($dsas == false || $dsas == null) {
          $errors[] = ["error" => "Error loading XML file"];
        } else if (! ctype_xdigit($id)) {
          $errors[] = ["error" => "The task ID is invalid"];
        } else {
          $deltask = false;
          $i = 0;
          foreach ($dsas->tasks->task as $task) {
            if ($task->id == $id) {
              if (dsas_task_running($id)) {
                $errors[] = ["error" => "Can not delete running task"];
              } else {
                if ($uri[3] == "tasks-all") {
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
        header("Content-Type: application/json");
        if ($dsas != false && $errors == []) {
          $dsas->asXml(_DSAS_XML);
          echo json_encode(["retval" => 0]);
        } else
          echo json_encode($errors);
        break;      

      default:
        header("HTTP/1.1 404 Not Found");
        break;
    }
  } else {
    header("HTTP/1.1 404 Not Found");
  }
} catch(RuntimeException $e) {
  header("HTTP/1.1 404 Not Found");
}

?>
