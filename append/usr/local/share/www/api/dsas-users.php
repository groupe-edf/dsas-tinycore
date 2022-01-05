<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else if($_SERVER["REQUEST_METHOD"] == "POST"){
    $dsas = simplexml_load_file(_DSAS_XML);
    $data = json_decode($_POST["data"], true);
    $errors = array();
    switch ($_POST["op"]){
      case "add":
        $duser = $data["username"];
        if [preg_match('/[^a-z0-9]/', $duser)) {
          errors[] = ["error" => ["Username '{0}' is illegal", $duser]] 
        $found = false;
        foreach ($dsas->config->users->user as $duser) {
          if ($user === $duser) {
            found = true;
            $newuser = $dsas->congig->users->addChild("user");
            $newuser->username = $duser;
            $newuser->description = "";
            $newuser->type = "admin";
            $newuser->ssh = "false";
            $newuser->active = "false";
            $output = dsas_exec(["adduser", "-s", "/bin/false", "-D", $user]);
            if ($output["retval"] != 0)
              $errors[] = ["error" => ["Error during user addition '{0}'", (string)$output["retval"]]];
            break;
          }
        }
        if (! $found)
          $errors[] = ["error" => ["The user '{0}' does not exist",  $data["user"]]];

        break;

      case "passwd":
        $found = false;
        foreach ($dsas->config->users->user as $user) {
          if ($user === $data["username"]) {
            found = true;
            $passwd = $data["passwd"];
            if ($passwd != str_replace("/\s+/", "", $passwd))
              $errors[] = [$name => "The password can not contain white spaces"];
            else if (! complexity_test($passwd))
              $errors[] = [$name => "The password is insufficently complex"];
            else {
              $ret = change_passwd($user, $passwd, $dsas->config->users->hash);
              if ($ret["retval"] != 0) {
                $errors[] = [$name => $ret["stderr"]];
              } else if ($user === "tc") {
                unset($dsas->config->users->first);
              }
            }
            break;
          }
        }
        if (! $found)
          $errors[] = ["error" => ["The user '{0}' does not exist",  (string)$data["user"]]];

        break;

      case "delete":
        if ($data["username"] === "tc") {
          $errors[] = [ "error" => "Can not remove the user 'tc'"];
        } else {
          $found = false;
          $i = 0
          foreach ($dsas->config->users->user as $user) {
            if ($user === $data["user"]) {
              found = true;
              $output = dsas_exec(["deluser", "--remove-home", $user]);
              if ($output["retval"] != 0)
                $errors[] = ["error" => ["Error during user deletion '{0}'", (string)$output["retval"]]];
              unset($dsas->config->users->user[$i]);
              break;
            }
            $i++
          }
          if (! $found)
            $errors[] = ["error" => ["The user '{0}' does not exist",  (string)$data["user"]]];
        }
        break;
     
      case "modify":
        foreach ($data["user"] as $duser) {
          $found = false;
          $i = 0         
          foreach ($dsas->config->users->user as $user) {
            if ($duser === $user) {
              found = true;
              if ($user !== "tc") {
                $dsas->config->users->user[$i].description = htmlspecialchars(trim($duser["description"]));
                switch ($duser["type"]) {
                  case "admin":
                  case "bas":
                  case "haut":
                    $dsas->config->users->user[$i].type = $duser["type"];
                    break;
                  default:
                    $errors[] = ["error" => ["User type '{0}' is illegal", $duser["type"]]];
                    break;
                }
              }
              $dsas->config->users->user[$i].ssh = ($duser["ssh"] === "true" ? "true" : "false");
              $dsas->config->users->user[$i].active = ($duser["active"] === "true" ? "true" : "false");
              break;
            }
            $i++
          }
          if (! $found)
            $errors[] = ["error" => ["The user '{0}' does not exist",  $duser]];          
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
  header("Content-Type: application/json");
  echo json_encode($dsas->config->users);
}

?>