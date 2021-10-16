<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else if($_SERVER["REQUEST_METHOD"] == "POST"){
  $users = json_decode($_POST["data"],true);
  $dsas = simplexml_load_file(_DSAS_XML);
  $old = -1;
  $i = 0;
  $errors = array();
  foreach ($users as $user) {
    if ($user["old"] == "true" && !empty($user["password"])) {
      $old = $i;
      break;
    }
    $i++;
  }
  if ( $old == -1 ) {
    $errors[] = ["old" => "The existing password is required"];
  } else {
    $nempty = 0;
    if (force_passwd()) {
      foreach ($dsas->config->users->user as $duser) {
        foreach ($users as $user) {
           if ((trim($user["username"]) == $duser) && (! empty($user["password"])))
             continue 2;
        }
        $nempty++;
      }
    }
    if ($nempty != 0) {
      $errors[] = ["error" => "First use. All of the passwords must be changed."];
    } else if (sasl_checkpass($users[$old]["username"], $users[$old]["password"])) {
      $errors[] = ["old" => "The existing password is incorrect"];
    } else {
      $count = 0;
      $hash = $dsas->config->users->hash;

      foreach ($users as $user) {
         if ($user["old"] == "true") continue;
         $name = trim($user["username"]);
         $passwd = trim($user["password"]);
         if (!empty($passwd)){
           if ($passwd != str_replace("/\s+/", "", $passwd))
             $errors[] = [$name => "The password can not contain white spaces"];
           else if (! complexity_test($passwd))
             $errors[] = [$name => "The password is insufficently complex"];
           else {
             $ret = change_passwd($name, $passwd, $hash);

             if ($ret["retval"] != 0) 
               $errors[] = [$name => $ret["stderr"]];
             else {
               $count++;
             }
           }
         }
      }

      if ($count == 0)
        $errors[] = ["error" => "No password has been changed."];
      else {
        unset($dsas->config->users->first);
        $dsas->asXml(_DSAS_XML);
      }
    }
  }
  if ($errors == [])
    echo "Ok";
  else  {
    header("Content-Type: application/json");
    echo json_encode($errors);
  }
} else {
  $dsas = simplexml_load_file(_DSAS_XML);
  header("Content-Type: application/json");
  echo json_encode($dsas->config->users);
}

?>