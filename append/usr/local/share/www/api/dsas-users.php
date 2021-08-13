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
           if (trim($user) == $duser)
             continue 2;
        }
        $nempty++;
      }
    }
    if ($nempty != 0) {
      $errors[] = ["error" => "Premiere usage. Tous les mots de passe doit-&ecirc;tre changer"];
    } else if (sasl_checkpass($_POST["users"][$i]["username"], $_POST["users"][$i]["password"])) {
      $errors[] = ["old" => "Mot de passe ancien incorrect"];
    } else {
      $count = 0;
      $hash = $dsas->config->users->hash;
      $cwd ="/tmp";
      $descriptorspec = array(
           0 => array("pipe", "r"), // stdin
           1 => array("pipe", "w"), // stdout
           2 => array("pipe", "w") //stderr
      );      

      foreach ($_POST["users"] as $user) {
         if ($user["old"] == "true") continue;
         $name = trim($user["username"]);
         $passwd = trim($user["password"]);
         if (!empty($passwd)){
           if (! complexity_test($passwd))
             $errors[] = [$name => "Mot de passe pas suffisament complexe"];
           else {
             // User proc_open with a command array to avoid spawning
             // a shell that can be attacked 
             $process = proc_open(["sudo", "/usr/sbin/chpasswd", "-c", $hash], $descriptorspec, $pipes, $cwd);
             $cmdarg = $name . ":" . $passwd;
             // password and username can't have be used to attack here as
             // there is no shell to attack. At this point its also too late
             // to pass args to chpasswd like "-c md5" to force a weak hash
             // So this is safe. 
             fwrite($pipes[0], escapeshellarg($name . ":" . $passwd) . PHP_EOL);
             fclose($pipes[0]);
             fclose($pipes[1]);
             $stderr = fgets($pipes[2]);
             fclose($pipes[2]);
             $retval = proc_close($process);

             if ($retval != 0) 
               $errors[] = [$name => $stderr];
             else {
               foreach ($dsas->config->users->user as $duser) {
                 if (trim($user) == $duser)
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