<?php
require_once "common.php";

if (! dsas_loggedin())
  header("HTTP/1.0 403 Forbidden");
else if($_SERVER["REQUEST_METHOD"] == "POST"){
    $dsas = simplexml_load_file(_DSAS_XML);
    /** @var array{username: string, passwd: string, description: string, type: string, active: string} $data */
    $data = json_decode($_POST["data"], true);
    if ($dsas === false) {
      header("Content-Type: application/json");
      echo json_encode(["error" => "Error loading XML file"]);
      die();
    }
    $errors = array();
    switch ($_POST["op"]){
      case "add":
        $duser = $data["username"];
        if (! preg_match('/^[a-z_]([a-z0-9_-]{0,31}|[a-z0-9_-]{0,30}\$)$/', $duser)) {
          $errors[] = ["error" => ["Username '{0}' is illegal", $duser]];
        } else {
          $found = false;
          foreach ($dsas->config->users->user as $user) {
            if ($user->username == $duser) {
              $found = true;
              break;
            }
          }
          if ($found) {
            $errors[] = ["error" => ["The user '{0}' already exists",  $duser]];
          } else {
            $newuser = $dsas->config->users->addChild("user");
            $newuser->username = $duser;
            $newuser->description = "";
            $newuser->type = "admin";
            $newuser->active = "false";
            $output = dsas_exec(["sudo", "adduser", "-G", "users", "-h", _DSAS_HOME . "/" . $duser, "-s", "/bin/sh", "-D", $duser]);
            if ($output["retval"] != 0)
              $errors[] = ["error" => ["Error during user addition '{0}'", (string)$output["stderr"]]];
            dsas_exec(["sudo", "chmod", "go-rwx", _DSAS_HOME ."/" . $duser]);
          }
        }
        break;

      case "passwd":
        $found = false;
        foreach ($dsas->config->users->user as $user) {
          if ($user->username == $data["username"]) {
            $found = true;
            $name = $data["username"];
            $passwd = $data["passwd"];
            if ($passwd != str_replace("/\s+/", "", $passwd))
              $errors[] = [$name => "The password can not contain white spaces"];
            else if (! complexity_test($passwd))
              $errors[] = [$name => "The password is insufficently complex"];
            else {
              $ret = change_passwd($name, $passwd, $dsas->config->users->hash);
              if ($ret["retval"] != 0) {
                $errors[] = [$name => $ret["stderr"]];
              } else if ($name == "tc") {
                unset($dsas->config->users->first);
              }
            }
            break;
          }
        }
        if (! $found)
          $errors[] = ["error" => ["The user '{0}' does not exist",  (string)$data["username"]]];

        break;

      case "delete":
        if ($data["username"] === "tc") {
          $errors[] = [ "error" => "Can not remove the user 'tc'"];
        } else if ($data["username"] === $_SESSION["username"]) {
          $errors[] = [ "error" => ["Can not remove loggedin user '{0}'", $data["username"]]];
        } else {
          $found = false;
          $i = 0;
          foreach ($dsas->config->users->user as $user) {
            if ($user->username == $data["username"]) {
              $found = true;
              unset($dsas->config->users->user[$i]);
              $output = dsas_exec(["sudo", "deluser", "--remove-home", (string)$data["username"]]);
              if ($output["retval"] != 0)
                $errors[] = ["error" => ["Error during user deletion '{0}'", (string)$output["stderr"]]];
              break;
            }
            $i++;
          }
          if (! $found)
            $errors[] = ["error" => ["The user '{0}' does not exist",  (string)$data["username"]]];
        }
        break;
     
      case "modify":
        /** @var array{username: string, passwd: string, description: string, type: string, active: string} $duser */  
        foreach ($data as $duser) {
          $found = false;
          $i = 0;         
          foreach ($dsas->config->users->user as $user) {
            if ($duser["username"] == $user->username) {
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

      default:
        $errors[] = ["error" => ["Unknown operation '{0}' requested", (string)$_POST["op"]]]; 
        break;
    }
    if ($errors == []) {
      $dsas->asXml(_DSAS_XML);
      echo "Ok";
    } else  {
      header("Content-Type: application/json");
      echo json_encode($errors);
    }
} else {
  $dsas = simplexml_load_file(_DSAS_XML);
  if (! $dsas)
    header("HTTP/1.0 500 Internal Server Error");
  else {
    header("Content-Type: application/json");
    echo json_encode($dsas->config->users);
  }
}

?>
