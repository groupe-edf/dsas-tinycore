<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else if($_SERVER["REQUEST_METHOD"] == "POST"){
  $dsas = simplexml_load_file(_DSAS_XML);
  $old = -1;
  $i = 0;
  $errors = array();
  foreach ($_POST["users"] as $user) {
    if ($user["old"] == "true" && !empty($user["password"])) {
      $old = $i;
      break;
    }
    $i++;
  }
  if ( $old == -1 ) {
    $errors[] = ["old" => "Le password ancien est requis"];
  } else {
    $nempty = 0;
    if (force_passwd()) {
      foreach ($dsas->config->users->user as $duser) {
        foreach ($_POST["users"] as $user) {
           if ((trim($user["username"]) == $duser) && (! empty($user["password"])))
             continue 2;
        }
        $nempty++;
      }
    }
    if ($nempty != 0) {
      $errors[] = ["error" => "Premiere usage. Tous les mots de passe doit-&ecirc;tre changer"];
    } else if (sasl_checkpass($_POST["users"][$old]["username"], $_POST["users"][$old]["password"])) {
      $errors[] = ["old" => "Mot de passe ancien incorrect"];
    } else {
      $count = 0;
      $hash = $dsas->config->users->hash;

      foreach ($_POST["users"] as $user) {
         if ($user["old"] == "true") continue;
         $name = trim($user["username"]);
         $passwd = trim($user["password"]);
         if (!empty($passwd)){
           if (! complexity_test($passwd))
             $errors[] = [$name => "Mot de passe pas suffisament complexe"];
           else if ($passwd != str_replace("/\s+/", "", $passwd))
             $errors[] = [$name => "Mot de passe ne peut pas contenir des espaces blancs"];
           else {
             $ret = change_passwd($name, $passwd, $hash);

             if ($ret["retval"] != 0) 
               $errors[] = [$name => $ret["stderr"]];
             else {
               foreach ($dsas->config->users->user as $duser) {
                 if ((trim($user["username"]) == $duser) && (! empty($user["password"])))
                   unset($user->first); 
               }
               $count++;
             }
           }
         }
      }

      if ($count == 0)
        $errors[] = ["error" => "Aucun mot de passe chang&eacute;."];
      else
        $dsas->asXml(_DSAS_XML);
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
  echo json_encode($dsas->config->users->user);
}

?>